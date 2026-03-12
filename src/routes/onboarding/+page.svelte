<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';

	export let data: any;

	let messages: { role: string; content: string }[] = [];
	let userInput = '';
	let loading = false;
	let error = '';
	let completed = data?.user?.hasOnboarded || false;

	let completionData: { level?: string; feedback?: string } = {
		level: data?.user?.cefrLevel,
		feedback: completed ? 'You have already completed your onboarding.' : undefined
	};

	const restartOnboarding = () => {
		completed = false;
		selectedPath = 'choose';
		messages = [];
		error = '';
	};
	let lastLevelGuess = data?.user?.cefrLevel || 'A1';

	// Path selection: 'language' | 'choose' | 'beginner' | 'test'
	let selectedPath: 'language' | 'choose' | 'beginner' | 'test' = 'language';
	let isSubmittingBeginner = false;

	const selectLanguage = async (languageId: string) => {
		try {
			const res = await fetch('/api/user/active-language', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ languageId })
			});
			if (res.ok) {
				await invalidateAll();
				selectedPath = 'choose';
			}
		} catch (e) {
			error = 'Failed to select language';
		}
	};

	const startPlacementTest = () => {
		selectedPath = 'test';
		sendMessage();
	};

	const handleBeginnerPath = async () => {
		if (completed || isSubmittingBeginner) return;
		isSubmittingBeginner = true;
		selectedPath = 'beginner';
		error = '';

		try {
			const res = await fetch('/api/onboarding/beginner', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to set up beginner account');
			}

			const data = await res.json();
			if (data.success) {
				completed = true;
				completionData = {
					level: data.level,
					feedback: data.message
				};
			}
		} catch (e: any) {
			error = e.message;
			selectedPath = 'choose';
		} finally {
			isSubmittingBeginner = false;
		}
	};

	// Start conversation by hitting API with empty messages
	const sendMessage = async () => {
		if (completed) return;
		if (userInput.trim() === '' && messages.length > 0) return;

		error = '';
		loading = true;

		// Add user's message to history
		if (userInput.trim()) {
			messages = [...messages, { role: 'user', content: userInput.trim() }];
			userInput = '';
		}

		try {
			const res = await fetch('/api/onboarding', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages })
			});

			if (!res.ok) {
				// Handle fetch errors (might be JSON or plain text)
				let errorData;
				try {
					errorData = await res.json();
				} catch (e) {
					throw new Error('Failed to send message');
				}
				throw new Error(errorData.error || 'Failed to send message');
			}

			// Add a placeholder for the assistant's message
			messages = [...messages, { role: 'assistant', content: '' }];
			const assistantIndex = messages.length - 1;
			loading = false; // Turn off "Thinking..."

			const reader = res.body?.getReader();
			if (!reader) throw new Error('Failed to get readable stream');

			const decoder = new TextDecoder();
			let responseText = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				responseText += decoder.decode(value, { stream: true });

				// Try to extract just the conversational message from the streaming JSON
				const match = responseText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)/);
				if (match && match[1]) {
					try {
						// parse securely if it represents a closed string
						messages[assistantIndex].content = JSON.parse(`"${match[1]}"`);
					} catch (e) {
						// fallback for incomplete string
						messages[assistantIndex].content = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
					}
					messages = [...messages];
				}
			}

			try {
				const data = JSON.parse(responseText);
				if (data.message) {
					messages[assistantIndex].content = data.message;
				}
				if (data.currentLevelGuess) {
					lastLevelGuess = data.currentLevelGuess;
				}
				if (data.completed) {
					completed = true;
					completionData = { level: data.level, feedback: data.feedback };
				}
			} catch (e) {
				console.error('Failed to parse full response', e, responseText);
			}
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	};

	let isSubmittingManual = false;

	const handleManualPlacement = async (level: string) => {
		if (completed || isSubmittingManual) return;
		isSubmittingManual = true;
		error = '';

		try {
			const res = await fetch('/api/onboarding/manual', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ level })
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to set manual level');
			}

			const data = await res.json();
			if (data.success) {
				completed = true;
				completionData = { level: data.level, feedback: 'You have manually selected your level.' };
			}
		} catch (e: any) {
			error = e.message;
		} finally {
			isSubmittingManual = false;
		}
	};

	let isEndingEarly = false;

	const handleEndEarly = async () => {
		if (completed || isEndingEarly) return;
		isEndingEarly = true;
		error = '';
		loading = true;

		try {
			// Use the last CEFR guess from the LLM instead of making another LLM call
			const res = await fetch('/api/onboarding', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages, endEarly: true, lastLevelGuess })
			});

			if (!res.ok) {
				let errorData;
				try {
					errorData = await res.json();
				} catch (e) {
					throw new Error('Failed to end early');
				}
				throw new Error(errorData.error || 'Failed to end early');
			}

			const data = await res.json();
			if (data.message) {
				messages = [...messages, { role: 'assistant', content: data.message }];
			}
			if (data.completed) {
				completed = true;
				completionData = { level: data.level, feedback: data.feedback };
			}
		} catch (e: any) {
			error = e.message;
		} finally {
			isEndingEarly = false;
			loading = false;
		}
	};
</script>

<svelte:head>
	<title>Adaptive Onboarding | LingoLearn</title>
</svelte:head>

<main
	class="onboarding-container"
	class:chat-active={messages.length > 0 || (selectedPath === 'test' && !completed)}
>
	{#if selectedPath === 'language' && !completed}
		   <header class="page-header" in:fly={{ y: 20, duration: 400 }}>
			   <h1 class="dark:text-white">Choose Your New Language</h1>
			   <p class="dark:text-slate-400">Which language would you like to start learning?</p>
		   </header>
		   <div class="path-selection horizontal" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			   {#each data.languages || [] as lang}
				   <button class="path-card dark:bg-slate-900 dark:border-slate-700" on:click={() => selectLanguage(lang.id)}>
					   <span class="path-icon">{lang.flag || '🌐'}</span>
					   <h2 class="dark:text-white">{lang.name}</h2>
				   </button>
			   {/each}
		   </div>
	{:else if selectedPath === 'choose' && !completed}
		<!-- Path Selection Screen -->
		<header class="page-header" in:fly={{ y: 20, duration: 400 }}>
			<h1 class="dark:text-white">Welcome to LingoLearn!</h1>
			<p class="dark:text-slate-400">
				Let's set up your learning experience. Choose the option that best describes you:
			</p>
		</header>

		<div class="path-selection" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<button
				class="path-card beginner-card dark:bg-slate-900 dark:border-emerald-900"
				on:click={handleBeginnerPath}
				disabled={isSubmittingBeginner}
			>
				<span class="path-icon">🌱</span>
				<h2 class="dark:text-white">I'm a Complete Beginner</h2>
				<p class="dark:text-slate-400">
					I have zero or almost zero language knowledge. Start me from the very basics — greetings,
					pronouns, simple words.
				</p>
				<span class="path-badge beginner-badge">Recommended for new learners</span>
			</button>

			<button
				class="path-card test-card dark:bg-slate-900 dark:border-emerald-900"
				on:click={startPlacementTest}
			>
				<span class="path-icon">💬</span>
				<h2 class="dark:text-white">I Know Some {data?.user?.activeLanguage?.name}</h2>
				<p class="dark:text-slate-400">
					I have some language knowledge. Chat with our AI teacher to find my level so I don't
					repeat what I already know.
				</p>
				<span class="path-badge test-badge">Takes 2-5 minutes</span>
			</button>

			<div class="manual-section dark:bg-slate-800 dark:border-slate-700">
				<p class="dark:text-slate-400">
					Or, if you already know your CEFR level, pick it directly:
				</p>
				<div class="level-buttons">
					{#each ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as lvl}
						<button
							class="btn btn-level dark:bg-slate-700 dark:text-slate-200"
							disabled={isSubmittingManual || isSubmittingBeginner}
							on:click={() => handleManualPlacement(lvl)}
						>
							{lvl}
						</button>
					{/each}
				</div>
			</div>
		</div>

		{#if error}
			<div class="error-alert">
				<p>{error}</p>
			</div>
		{/if}
	{:else}
		<!-- Placement Test / Completion -->
		<header class="page-header" in:fly={{ y: 20, duration: 400 }}>
			{#if completed}
				<h1 class="dark:text-white">You're All Set!</h1>
				<p class="dark:text-slate-400">We've prepared a personalized curriculum for you.</p>
			{:else}
				<h1 class="dark:text-white">Placement Test</h1>
				<p class="dark:text-slate-400">
					Chat with our AI teacher to determine your starting level.
				</p>
			{/if}
		</header>

		<div class="content-layout" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<div class="chat-container dark:bg-slate-800 dark:border-slate-700">
				{#if messages.length > 0 || loading || error}
					<div class="chat-messages dark:bg-slate-900">
						{#each messages as msg}
							<div class="message-wrapper {msg.role === 'user' ? 'user' : 'assistant'}">
								<span class="message-sender dark:text-slate-500"
									>{msg.role === 'user' ? 'You' : 'Teacher'}</span
								>
								<div
									class="message-bubble {msg.role === 'user'
										? 'user'
										: 'assistant dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'}"
								>
									{msg.content}
								</div>
							</div>
						{/each}

						{#if loading}
							<div class="message-wrapper assistant">
								<span class="message-sender dark:text-slate-500">Teacher</span>
								<div
									class="message-bubble assistant loading dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700"
								>
									Thinking...
								</div>
							</div>
						{/if}

						{#if error}
							<div class="error-alert">
								<p>{error}</p>
							</div>
						{/if}
					</div>
				{/if}

				{#if completed}
					<div
						class="completion-card dark:bg-slate-900 dark:border-emerald-900"
						class:no-messages={messages.length === 0}
					>
						<h2 class="dark:text-emerald-400">Onboarding Complete!</h2>
						<div class="level-result">
							<span class="dark:text-emerald-500">Your assessed level:</span>
							<strong class="level-badge dark:bg-emerald-900 dark:text-emerald-300"
								>{completionData.level}</strong
							>
						</div>
						{#if completionData.feedback}
							<p class="feedback-text dark:text-emerald-500">
								<strong>Feedback:</strong>
								{completionData.feedback}
							</p>
						{/if}
						<div class="completion-actions dark:border-emerald-900">
							{#if selectedPath === 'beginner'}
								<p class="action-note dark:text-emerald-500">
									We've loaded essential starter vocabulary and grammar for you. Your lessons will
									begin with the very basics — no prior language knowledge needed!
								</p>
							{:else}
								<p class="action-note dark:text-emerald-500">
									Your personalized curriculum has been bulk-generated. We've marked the basics you
									already know as Mastered!
								</p>
							{/if}
							<div style="display: flex; gap: 1rem; flex-wrap: wrap;">
								<button class="btn btn-success" on:click={() => (window.location.href = '/')}>
									Go to Dashboard
								</button>
								<button class="btn btn-primary" on:click={() => (window.location.href = '/play')}>
									Start Learning
								</button>
								<button class="btn btn-secondary" on:click={restartOnboarding}>
									Restart Onboarding
								</button>
							</div>
						</div>
					</div>
				{:else}
					<form
						class="chat-input-form dark:bg-slate-800 dark:border-slate-700"
						on:submit|preventDefault={sendMessage}
					>
						<input
							type="text"
							bind:value={userInput}
							disabled={loading || completed}
							placeholder="Type your reply here..."
							class="chat-input dark:bg-slate-900 dark:text-white dark:border-slate-700"
						/>
						<button
							type="submit"
							disabled={loading || completed || !userInput.trim()}
							class="btn btn-primary"
						>
							Send
						</button>
						{#if messages.filter((m) => m.role === 'user').length >= 1}
							<button
								type="button"
								class="btn btn-secondary"
								disabled={loading || completed || isEndingEarly}
								on:click={handleEndEarly}
							>
								End Early
							</button>
						{/if}
					</form>
				{/if}
			</div>

			{#if !completed}
				<div class="side-panel">
					<div class="manual-placement dark:bg-slate-800 dark:border-slate-700">
						<p class="dark:text-slate-300">Or skip the test and choose your level manually:</p>
						<div class="level-buttons">
							{#each ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as lvl}
								<button
									class="btn btn-level dark:bg-slate-700 dark:text-slate-200"
									disabled={isSubmittingManual || loading}
									on:click={() => handleManualPlacement(lvl)}
								>
									{lvl}
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif;
		background-color: var(--bg-color, #f8fafc);
		color: var(--text-color, #334155);
	}

	.onboarding-container {
		display: flex;
		flex-direction: column;
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.onboarding-container.chat-active {
		height: 85vh;
		min-height: 500px;
	}

	.page-header {
		margin-bottom: 1.5rem;
	}

	.page-header h1 {
		font-size: 2rem;
		color: #0f172a;
		margin: 0 0 0.5rem 0;
	}

	.page-header p {
		color: #64748b;
		font-size: 1.1rem;
		margin: 0;
	}

	.content-layout {
		display: flex;
		gap: 1.5rem;
		flex: 1;
		min-height: 0;
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		background: var(--card-bg, #ffffff);
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border: 1px solid var(--card-border, #e2e8f0);
		overflow: hidden;
	}

	.side-panel {
		flex: 0 0 250px;
		display: flex;
		flex-direction: column;
	}

	.manual-placement {
		background: var(--card-bg, #f1f5f9);
		padding: 1.25rem;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
		border: 1px solid var(--card-border, #e2e8f0);
	}

	.manual-placement p {
		margin: 0;
		font-weight: 500;
		color: #475569;
		line-height: 1.4;
	}

	.level-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-start;
	}

	@media (max-width: 768px) {
		.content-layout {
			flex-direction: column;
		}

		.side-panel {
			flex: auto;
		}

		.manual-placement {
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}
	}

	.btn-level {
		background-color: #e2e8f0;
		color: #334155;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-weight: 600;
		transition: all 0.2s;
	}

	.btn-level:hover:not(:disabled) {
		background-color: #cbd5e1;
		color: #0f172a;
	}

	.btn-level:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.chat-messages {
		flex: 1;
		padding: 1.5rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		background-color: var(--bg-color, #f8fafc);
	}

	.message-wrapper {
		display: flex;
		flex-direction: column;
		max-width: 80%;
	}

	.message-wrapper.user {
		align-self: flex-end;
		align-items: flex-end;
	}

	.message-wrapper.assistant {
		align-self: flex-start;
		align-items: flex-start;
	}

	.message-sender {
		font-size: 0.75rem;
		color: #64748b;
		margin-bottom: 0.25rem;
		font-weight: 500;
	}

	.message-bubble {
		padding: 0.75rem 1rem;
		border-radius: 1rem;
		font-size: 1rem;
		line-height: 1.5;
		word-break: break-word;
		white-space: pre-wrap;
		white-space: pre-wrap;
	}

	.message-bubble.user {
		background-color: #22c55e;
		color: #ffffff;
		border-bottom-right-radius: 0.25rem;
	}

	.message-bubble.assistant {
		background-color: var(--card-bg, #ffffff);
		color: var(--text-color, #1e293b);
		border: 1px solid var(--card-border, #e2e8f0);
		border-bottom-left-radius: 0.25rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.message-bubble.loading {
		font-style: italic;
		color: #94a3b8;
	}

	.error-alert {
		background-color: #fef2f2;
		border-left: 4px solid #ef4444;
		color: #b91c1c;
		padding: 1rem;
		border-radius: 0.25rem;
		margin-top: 1rem;
		align-self: center;
		width: 100%;
		max-width: 90%;
	}

	.error-alert p {
		margin: 0;
	}

	.chat-input-form {
		display: flex;
		gap: 0.75rem;
		padding: 1rem;
		background-color: var(--card-bg, #ffffff);
		border-top: 1px solid var(--card-border, #e2e8f0);
	}

	.chat-input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 1px solid var(--input-border, #cbd5e1);
		border-radius: 0.5rem;
		font-size: 1rem;
		font-family: inherit;
		color: var(--input-text, #111827);
		background-color: var(--input-bg, #ffffff);
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.chat-input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.chat-input:disabled {
		background-color: #f1f5f9;
		color: #94a3b8;
		cursor: not-allowed;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 0.5rem;
		border: none;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #22c55e;
		color: #ffffff;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #16a34a;
	}

	.btn-secondary {
		background-color: #ef4444;
		color: #ffffff;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #dc2626;
	}

	.btn-success {
		background-color: #16a34a;
		color: #ffffff;
	}

	.btn-success:hover:not(:disabled) {
		background-color: #15803d;
	}

	.completion-card {
		padding: 1.5rem;
		background-color: #f0fdf4;
		border-top: 1px solid #bbf7d0;
	}

	:global(html[data-theme='dark']) .completion-card {
		background-color: #0d1f14;
		border-top-color: #166534;
	}

	.completion-card.no-messages {
		display: flex;
		flex-direction: column;
		justify-content: center;
		border-top: none;
	}

	.completion-card h2 {
		margin: 0 0 1rem 0;
		color: #166534;
		font-size: 1.5rem;
	}

	.level-result {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-size: 1.1rem;
		color: #15803d;
	}

	.level-badge {
		background-color: #bbf7d0;
		color: #166534;
		padding: 0.25rem 0.75rem;
		border-radius: 0.25rem;
		font-weight: 700;
	}

	.feedback-text {
		color: #166534;
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}

	.completion-actions {
		border-top: 1px solid #bbf7d0;
		padding-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.action-note {
		color: #15803d;
		font-style: italic;
		font-size: 0.95rem;
		margin: 0;
	}

	:global(html[data-theme='dark']) .completion-card h2 {
		color: #4ade80;
	}

	:global(html[data-theme='dark']) .level-result {
		color: #86efac;
	}

	:global(html[data-theme='dark']) .level-badge {
		background-color: #166534;
		color: #bbf7d0;
	}

	:global(html[data-theme='dark']) .feedback-text {
		color: #86efac;
	}

	:global(html[data-theme='dark']) .completion-actions {
		border-top-color: #166534;
	}

	:global(html[data-theme='dark']) .action-note {
		color: #86efac;
	}

	/* Path Selection Styles */
	   .path-selection {
		   display: flex;
		   flex-direction: column;
		   gap: 1.25rem;
		   max-width: 700px;
		   margin: 0 auto;
	   }

	   .path-selection.horizontal {
		   flex-direction: row;
		   justify-content: center;
		   gap: 1.25rem;
		   flex-wrap: wrap;
	   }

	.path-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 1.5rem;
		border-radius: 16px;
		border: 2px solid var(--card-border, #e2e8f0);
		background: var(--card-bg, #ffffff);
		cursor: pointer;
		transition: all 0.25s;
		text-align: center;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
	}

	.path-card:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
	}

	.path-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.path-card h2 {
		margin: 0;
		font-size: 1.35rem;
		color: #0f172a;
	}

	.path-card p {
		margin: 0;
		color: #64748b;
		line-height: 1.5;
		font-size: 0.95rem;
	}

	.path-icon {
		font-size: 2.5rem;
	}

	.path-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.beginner-card {
		border-color: #e5e7eb;
		background: linear-gradient(135deg, #f8fafc 0%, var(--card-bg, #ffffff) 100%);
	}

	.beginner-card:hover:not(:disabled) {
		border-color: #94a3b8;
	}

	.beginner-card .path-badge {
		background-color: #dcfce7;
		color: #166534;
	}

	.test-card {
		border-color: #86efac;
		background: linear-gradient(135deg, #f0fdf4 0%, var(--card-bg, #ffffff) 100%);
	}

	.test-card:hover:not(:disabled) {
		border-color: #22c55e;
	}

	.test-card .path-badge {
		background-color: #dcfce7;
		color: #166534;
	}

	.manual-section {
		background: #f8fafc;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid #e2e8f0;
		text-align: center;
	}

	.manual-section p {
		margin: 0 0 0.75rem 0;
		color: #64748b;
		font-size: 0.9rem;
	}

	.manual-section .level-buttons {
		justify-content: center;
	}
</style>
