<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import toast from 'svelte-french-toast';
	import { fly } from 'svelte/transition';

	let sessionStarted = false;
	let sessionId = '';
	let persona = 'A friendly waiter at a café';

	$: language = $page.data.user?.activeLanguage?.name || 'German';
	let message = '';
	let isLoading = false;
	let chatContainer: HTMLElement;

	const TOPICS = [
		'A friendly waiter at a café',
		'A strict border control officer',
		'A talkative taxi driver',
		'A helpful librarian',
		'A neighbor who lost their dog',
		'A language teacher evaluating your skills',
		'A confused tourist asking for directions',
		'A seller at a local market',
		'A coworker discussing a project',
		"An old friend you haven't seen in years"
	];

	function randomizeTopic() {
		let newTopic;
		do {
			const randomIndex = Math.floor(Math.random() * TOPICS.length);
			newTopic = TOPICS[randomIndex];
		} while (newTopic === persona && TOPICS.length > 1);
		persona = newTopic;
	}

	interface ChatMessage {
		id: string;
		role: string;
		content: string;
		correction?: string | null;
	}

	let messages: ChatMessage[] = [];

	async function scrollToBottom() {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	async function startSession() {
		if (!persona.trim() || !language?.trim()) {
			toast.error('Please select a language and enter a persona.');
			return;
		}
		sessionStarted = true;
		messages = [];
		// Add an initial empty state or we can just let the user send the first message.
		scrollToBottom();
	}

	async function sendMessage() {
		if (!message.trim() || isLoading) return;

		const userMessageText = message;
		message = '';

		const tempUserMessage: ChatMessage = {
			id: Date.now().toString(),
			role: 'user',
			content: userMessageText
		};
		messages = [...messages, tempUserMessage];
		scrollToBottom();
		isLoading = true;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionId || undefined,
					message: userMessageText,
					persona,
					language
				})
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to send message');
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error('No response stream');

			const assistantMessage: ChatMessage = {
				id: Date.now().toString() + '-ai',
				role: 'assistant',
				content: ''
			};
			messages = [...messages, assistantMessage];

			const decoder = new TextDecoder();
			let buffer = '';
			let fullContent = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const event = JSON.parse(line);
						if (event.type === 'metadata') {
							if (!sessionId) {
								sessionId = event.sessionId;
							}
						} else if (event.type === 'chunk') {
							fullContent += event.content;

							// Try to extract just the reply part if we can see it
							// The JSON looks like {"reply": "something", "correction": null}
							const replyMatch = fullContent.match(/"reply"\s*:\s*"([^]*)/);
							if (replyMatch && replyMatch[1]) {
								// Get everything after "reply": " up to the next unescaped quote, or end of string
								let extracted = replyMatch[1];
								const endQuoteIdx = extracted.indexOf('",');
								if (endQuoteIdx !== -1) {
									extracted = extracted.substring(0, endQuoteIdx);
								} else {
									const endBraceIdx = extracted.lastIndexOf('"}');
									if (endBraceIdx !== -1) {
										extracted = extracted.substring(0, endBraceIdx);
									}
								}
								// Handle basic escaped quotes
								extracted = extracted
									.replace(/\\"/g, '"')
									.replace(/\\\\/g, '\\')
									.replace(/\\n/g, '\n');

								messages = messages.map((m) =>
									m.id === assistantMessage.id ? { ...m, content: extracted } : m
								);
								scrollToBottom();
							}
						} else if (event.type === 'done') {
							messages = messages.map((m) =>
								m.id === assistantMessage.id
									? { ...m, content: event.message.content, correction: event.message.correction }
									: m
							);
							scrollToBottom();
						}
					} catch (err) {
						// ignore parse errors for partial lines
					}
				}
			}

			// flush buffer
			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer.trim());
					if (event.type === 'done') {
						messages = messages.map((m) =>
							m.id === assistantMessage.id
								? { ...m, content: event.message.content, correction: event.message.correction }
								: m
						);
						scrollToBottom();
					}
				} catch (err) {}
			}
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'An error occurred.');
			// Remove the optimistic message if it failed
			messages = messages.filter((m) => m.id !== tempUserMessage.id);
		} finally {
			isLoading = false;
		}
	}

	async function startAIConversation() {
		if (isLoading) return;
		isLoading = true;

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId: sessionId || undefined,
					message: `Please ask me a beginner-friendly question to start the conversation in ${language}.`,
					persona,
					language
				})
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to send message');
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error('No response stream');

			const assistantMessage: ChatMessage = {
				id: Date.now().toString() + '-ai',
				role: 'assistant',
				content: ''
			};
			messages = [...messages, assistantMessage];

			const decoder = new TextDecoder();
			let buffer = '';
			let fullContent = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const event = JSON.parse(line);
						if (event.type === 'metadata') {
							if (!sessionId) {
								sessionId = event.sessionId;
							}
						} else if (event.type === 'chunk') {
							fullContent += event.content;

							// Try to extract just the reply part if we can see it
							const replyMatch = fullContent.match(/"reply"\s*:\s*"([^]*)/);
							if (replyMatch && replyMatch[1]) {
								let extracted = replyMatch[1];
								const endQuoteIdx = extracted.indexOf('",');
								if (endQuoteIdx !== -1) {
									extracted = extracted.substring(0, endQuoteIdx);
								} else {
									const endBraceIdx = extracted.lastIndexOf('"}');
									if (endBraceIdx !== -1) {
										extracted = extracted.substring(0, endBraceIdx);
									}
								}
								extracted = extracted
									.replace(/\\"/g, '"')
									.replace(/\\\\/g, '\\')
									.replace(/\\n/g, '\n');

								messages = messages.map((m) =>
									m.id === assistantMessage.id ? { ...m, content: extracted } : m
								);
								scrollToBottom();
							}
						} else if (event.type === 'done') {
							messages = messages.map((m) =>
								m.id === assistantMessage.id
									? { ...m, content: event.message.content, correction: event.message.correction }
									: m
							);
							scrollToBottom();
						}
					} catch (err) {
						// ignore parse errors for partial lines
					}
				}
			}

			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer.trim());
					if (event.type === 'done') {
						messages = messages.map((m) =>
							m.id === assistantMessage.id
								? { ...m, content: event.message.content, correction: event.message.correction }
								: m
						);
						scrollToBottom();
					}
				} catch (err) {}
			}
		} catch (error: any) {
			console.error(error);
			toast.error(error.message || 'An error occurred.');
		} finally {
			isLoading = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}
</script>

<div class="chat-container">
	<div class="chat-header-main" in:fly={{ y: 20, duration: 400 }}>
		<h1>AI Chat Practice</h1>
	</div>

	{#if !sessionStarted}
		<div class="card-duo setup-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<h2>Start a new roleplay</h2>
			<div class="form-group">
				<div>
					<div class="label-row">
						<label for="persona">Persona / Scenario</label>
						<button class="randomize-btn" on:click={randomizeTopic} title="Randomize Topic">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"
								/>
							</svg>
						</button>
					</div>
					<input
						type="text"
						id="persona"
						bind:value={persona}
						placeholder="e.g. A friendly waiter at a café"
					/>
				</div>
				<button on:click={startSession} class="btn-duo btn-primary start-btn">
					Start Conversation
				</button>
			</div>
		</div>
	{:else}
		<div class="card-duo chat-box" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<!-- Header -->
			<div class="chat-header">
				<div class="persona-info">
					<span class="persona-name">{persona}</span>
					<span class="persona-lang">{language}</span>
				</div>
				<button
					on:click={() => {
						sessionStarted = false;
						sessionId = '';
					}}
					class="end-session-btn"
				>
					End Session
				</button>
			</div>

			<!-- Messages Area -->
			<div class="messages-area" bind:this={chatContainer}>
				<div class="messages-list">
					{#if messages.length === 0}
						<div class="empty-state">
							<div class="wave">👋</div>
							<p>Start the conversation! Introduce yourself or say hello.</p>
							<button on:click={startAIConversation} class="ai-start-btn" disabled={isLoading}>
								Make the AI ask the first question
							</button>
						</div>
					{/if}

					{#each messages as msg}
						<div class="message-row {msg.role === 'user' ? 'row-user' : 'row-assistant'}">
							<div
								class="message-content {msg.role === 'user' ? 'content-user' : 'content-assistant'}"
							>
								<div class="bubble {msg.role === 'user' ? 'bubble-user' : 'bubble-assistant'}">
									<p>{msg.content}</p>
								</div>

								{#if msg.correction}
									<div class="correction-box">
										<div class="correction-header">
											<svg
												class="icon"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
												/>
											</svg>
											Correction
										</div>
										<p>{msg.correction}</p>
									</div>
								{/if}
							</div>
						</div>
					{/each}

					{#if isLoading}
						<div class="message-row row-assistant">
							<div class="bubble bubble-assistant typing-indicator">
								<div class="dot"></div>
								<div class="dot"></div>
								<div class="dot"></div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Input Area -->
			<div class="input-area">
				<div class="input-wrapper">
					<div class="textarea-container">
						<textarea
							bind:value={message}
							on:keydown={handleKeydown}
							placeholder="Type your message... (Enter to send)"
							rows="1"
							disabled={isLoading}
						></textarea>
					</div>
					<button on:click={sendMessage} disabled={isLoading || !message.trim()} class="send-btn">
						<svg
							class="icon"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.chat-container {
		max-width: 56rem;
		margin: 0 auto;
		padding: 1rem;
	}

	@media (min-width: 768px) {
		.chat-container {
			padding: 2rem;
		}
	}

	.chat-header-main {
		margin-bottom: 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chat-header-main h1 {
		font-size: 1.875rem;
		font-weight: 800;
		letter-spacing: -0.025em;
	}

	.setup-card {
		padding: 1.5rem;
	}

	@media (min-width: 768px) {
		.setup-card {
			padding: 2rem;
		}
	}

	.setup-card h2 {
		margin-bottom: 1.5rem;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group label {
		margin-bottom: 0.5rem;
		display: block;
		font-weight: 700;
		color: var(--text-color, #334155);
	}

	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.label-row label {
		margin-bottom: 0;
	}

	.randomize-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: #64748b;
		padding: 0.25rem;
		border-radius: 0.375rem;
		transition:
			color 0.2s,
			background-color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.randomize-btn:hover {
		color: #3b82f6;
		background-color: #f1f5f9;
	}

	.randomize-btn svg {
		width: 1.25rem;
		height: 1.25rem;
	}

	:global(html[data-theme='dark']) .randomize-btn:hover {
		background-color: #334155;
	}

	.form-group input {
		width: 100%;
		border-radius: 0.75rem;
		border: 2px solid var(--input-border, #e2e8f0);
		background-color: var(--input-bg, #ffffff);
		padding: 0.75rem 1rem;
		font-size: 1.125rem;
		font-weight: 500;
		color: var(--input-text, #0f172a);
		outline: none;
		transition: border-color 0.2s;
		box-sizing: border-box;
	}

	.form-group input:focus {
		border-color: #3b82f6;
	}

	.start-btn {
		margin-top: 1rem;
		width: 100%;
		padding-top: 1rem;
		padding-bottom: 1rem;
		font-size: 1.125rem;
	}

	.chat-box {
		display: flex;
		height: 600px;
		flex-direction: column;
		overflow: hidden;
		padding: 0;
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 2px solid var(--card-border, #f1f5f9);
		background-color: var(--header-bg, #f8fafc);
		padding: 1rem 1.5rem;
	}

	.persona-info {
		display: flex;
		flex-direction: column;
	}

	.persona-name {
		font-weight: 700;
	}

	.persona-lang {
		font-size: 0.875rem;
		font-weight: 600;
		color: #64748b;
	}

	.end-session-btn {
		border-radius: 9999px;
		background-color: #e2e8f0;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 700;
		color: #475569;
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.end-session-btn:hover {
		background-color: #cbd5e1;
	}

	.messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.empty-state {
		margin-top: 2.5rem;
		text-align: center;
		font-weight: 500;
		color: #64748b;
	}

	.ai-start-btn {
		margin-top: 1.5rem;
		font-size: 0.9375rem;
		padding: 0.75rem 1.25rem;
		background-color: var(--card-bg, #ffffff);
		color: #3b82f6;
		border: 2px solid #3b82f6;
		border-radius: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.ai-start-btn:hover:not(:disabled) {
		background-color: #eff6ff;
	}

	.ai-start-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(html[data-theme='dark']) .ai-start-btn {
		background-color: #1e293b;
		color: #60a5fa;
		border-color: #3b82f6;
	}

	:global(html[data-theme='dark']) .ai-start-btn:hover:not(:disabled) {
		background-color: #334155;
	}

	.wave {
		margin-bottom: 1rem;
		font-size: 3.75rem;
	}

	.message-row {
		display: flex;
		width: 100%;
	}

	.row-user {
		justify-content: flex-end;
	}

	.row-assistant {
		justify-content: flex-start;
	}

	.message-content {
		display: flex;
		max-width: 85%;
		flex-direction: column;
	}

	.content-user {
		align-items: flex-end;
	}

	.content-assistant {
		align-items: flex-start;
	}

	.bubble {
		position: relative;
		border-radius: 1rem;
		padding: 0.875rem 1.25rem;
		font-size: 0.9375rem;
		line-height: 1.625;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.bubble p {
		margin: 0;
		white-space: pre-wrap;
	}

	.bubble-user {
		border-bottom-right-radius: 0.125rem;
		background-color: #3b82f6;
		color: white;
	}

	.bubble-assistant {
		border-bottom-left-radius: 0.125rem;
		border: 1px solid var(--card-border, #e2e8f0);
		background-color: var(--card-bg, #ffffff);
	}

	.correction-box {
		margin-top: 0.5rem;
		border-radius: 0.75rem;
		border: 2px solid #fed7aa;
		background-color: #fff7ed;
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #7c2d12;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		animation: fadeIn 0.3s ease-in-out;
	}

	.correction-header {
		margin-bottom: 0.25rem;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-weight: 700;
		color: #ea580c;
	}

	.correction-header .icon {
		height: 1rem;
		width: 1rem;
	}

	.correction-box p {
		margin: 0;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.typing-indicator {
		display: flex;
		gap: 0.375rem;
		padding: 1rem 1.25rem;
	}

	.dot {
		height: 0.5rem;
		width: 0.5rem;
		border-radius: 9999px;
		background-color: #94a3b8;
		animation: bounce 1s infinite;
	}

	.dot:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dot:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-25%);
		}
	}

	.input-area {
		border-top: 2px solid var(--card-border, #f1f5f9);
		background-color: var(--card-bg, #ffffff);
		padding: 1rem;
	}

	.input-wrapper {
		display: flex;
		align-items: flex-end;
		gap: 0.75rem;
	}

	.textarea-container {
		position: relative;
		flex: 1;
	}

	.textarea-container textarea {
		display: block;
		width: 100%;
		resize: none;
		border-radius: 0.75rem;
		border: 2px solid var(--input-border, #e2e8f0);
		background-color: var(--input-bg, #f8fafc);
		padding: 0.75rem 1rem;
		padding-right: 3rem;
		font-size: 0.9375rem;
		font-weight: 500;
		color: var(--input-text, #0f172a);
		outline: none;
		transition:
			border-color 0.2s,
			background-color 0.2s;
		min-height: 52px;
		max-height: 8rem;
		box-sizing: border-box;
		font-family: inherit;
	}

	.textarea-container textarea:focus {
		border-color: #3b82f6;
		background-color: var(--card-bg, #ffffff);
	}

	.textarea-container textarea:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.send-btn {
		display: flex;
		height: 52px;
		width: 52px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		background-color: #3b82f6;
		color: white;
		box-shadow: 0 4px 0 #2563eb;
		transition:
			transform 0.1s,
			box-shadow 0.1s,
			background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.send-btn:hover:not(:disabled) {
		background-color: #60a5fa;
		box-shadow: 0 4px 0 #2563eb;
	}

	.send-btn:active:not(:disabled) {
		transform: translateY(4px);
		box-shadow: 0 0 0 #2563eb;
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	.send-btn .icon {
		height: 1.5rem;
		width: 1.5rem;
	}

	:global(html[data-theme='dark']) .end-session-btn {
		background-color: #334155;
		color: #cbd5e1;
	}

	:global(html[data-theme='dark']) .end-session-btn:hover {
		background-color: #475569;
	}

	:global(html[data-theme='dark']) .correction-box {
		border-color: rgba(124, 45, 18, 0.5);
		background-color: rgba(124, 45, 18, 0.2);
		color: #fed7aa;
	}

	:global(html[data-theme='dark']) .correction-header {
		color: #fb923c;
	}
</style>
