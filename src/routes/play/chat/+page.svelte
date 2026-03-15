<script lang="ts">
	import { page } from '$app/stores';
	import { tick } from 'svelte';
	import toast from 'svelte-french-toast';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';

	export let data;

	let sessionStarted = false;

	// Only show a correction if it actually contains an error, not a "looks good" message
	function parseCorrection(correction: string | null | undefined): string | null {
		if (!correction) return null;
		const lower = correction.toLowerCase().trim();
		const noErrorPhrases = [
			'your sentence is correct',
			'no grammatical error',
			'no errors',
			'no correction needed',
			'looks correct',
			'is correct',
			'correctly',
			'well done',
			'great job',
			'perfect',
			'no mistakes',
			'no issues'
		];
		if (noErrorPhrases.some((p) => lower.includes(p))) return null;
		return correction;
	}
	let showTopicChange = false;
	let newPersona = '';
	let sessionId = '';

	// Assignment state
	$: assignment = data.assignment;
	$: assignmentScore = data.assignmentScore;
	$: isAssignment = !!assignment;
	let isPassed = assignmentScore?.passed || false;
	$: targetScore = assignment?.targetScore || 10;
	let messagesSent = assignmentScore?.score || 0;

	let persona = 'A friendly waiter at a café';
	$: {
		if (isAssignment && assignment?.topic) {
			persona = assignment.topic;
		}
	}

	$: language = $page.data.user?.activeLanguage?.name || 'German';
	let message = '';
	let isLoading = false;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let isTyping = false;
	let chatContainer: HTMLElement;
	let chatInputRef: HTMLTextAreaElement;

	const TOPICS = [
		// Food & Dining
		'A friendly waiter at a café',
		'A barista who takes coffee very seriously',
		'A street food vendor recommending their best dish',
		'A sommelier at a fancy restaurant',
		'A bakery owner proud of their sourdough',
		'A chef who wants your honest opinion on their new recipe',
		'A fast food cashier dealing with a long line',

		// Travel & Transport
		'A strict border control officer',
		'A talkative taxi driver',
		'A confused tourist asking for directions',
		'A train conductor checking tickets on a delayed train',
		'A hotel receptionist during a fully booked weekend',
		'A flight attendant on a turbulent flight',
		'A tour guide at a historic castle',
		'A fellow backpacker at a hostel',
		'A bus driver who knows every stop by heart',
		'A cruise ship activity coordinator',

		// Shopping & Services
		'A seller at a local market',
		'A pushy salesperson at an electronics store',
		'A tailor adjusting your suit for a wedding',
		'A florist helping you pick flowers for an apology',
		'A pharmacist recommending cold remedies',
		'A used car salesperson with a suspiciously good deal',
		'A bookshop owner who has read everything',
		'A cashier at a busy supermarket',

		// Work & Professional
		'A coworker discussing a project',
		'A job interviewer asking tough questions',
		'A new boss on your first day at work',
		'An IT support person walking you through a fix',
		'A freelance client with impossible deadlines',
		'A coworker organizing the office holiday party',
		'A real estate agent showing you an apartment',
		'A bank teller helping you open an account',

		// Social & Personal
		"An old friend you haven't seen in years",
		'A neighbor who lost their dog',
		'A roommate who wants to set house rules',
		'A stranger sitting next to you on a long train ride',
		'A chatty hairdresser during a haircut',
		'A parent at a school pickup making small talk',
		'A gym buddy suggesting a new workout routine',
		'Someone at a party who only speaks your target language',

		// Education & Culture
		'A language teacher evaluating your skills',
		'A helpful librarian',
		'A museum guide explaining a controversial artwork',
		'A university professor during office hours',
		'A classmate studying for the same exam',
		'A music teacher who only communicates through metaphors',
		'A film buff debating the best movies of all time',

		// Health & Wellness
		'A doctor during a routine checkup',
		'A dentist making conversation while you can barely talk',
		'A yoga instructor who is extremely calm',
		'A personal trainer pushing you to your limits',
		'A therapist asking how your week went',

		// Daily Life & Errands
		'A postal worker helping with an international package',
		'A mechanic explaining what is wrong with your car',
		'A landlord discussing a leaky faucet',
		'A dog walker in the park chatting about breeds',
		'A locksmith after you locked yourself out',
		'A neighbor complaining about noise',
		'A plumber who showed up three hours late',

		// Entertainment & Hobbies
		'A passionate football fan during a big match',
		'A board game enthusiast explaining complex rules',
		'A hiking guide on a mountain trail',
		'A cooking class instructor demonstrating a recipe',
		'A DJ taking music requests at a club',
		'A theater usher before a sold-out show',
		'A fellow gardener at a community garden',

		// Emergencies & Unusual Situations
		'A police officer who pulled you over',
		'A firefighter doing a safety inspection',
		'A lost child looking for their parents at a mall',
		'A park ranger warning about wildlife',
		'A lifeguard at a crowded beach',

		// Quirky & Fun
		'A conspiracy theorist at a bus stop',
		'A fortune teller at a carnival',
		'A very dramatic weather reporter',
		'A pet shop owner who talks to the animals',
		'An overly enthusiastic fitness influencer',
		'A grumpy old man feeding pigeons in the park',
		'A wedding planner in full crisis mode',
		'A detective asking you about something you witnessed',
		'An alien who just landed and is learning human customs',
		'A time traveler confused by modern technology'
	];

	function randomizeTopic() {
		let newTopic;
		do {
			const randomIndex = Math.floor(Math.random() * TOPICS.length);
			newTopic = TOPICS[randomIndex];
		} while (newTopic === persona && TOPICS.length > 1);
		persona = newTopic;
	}

	function openTopicChange() {
		newPersona = persona;
		showTopicChange = true;
	}

	function cancelTopicChange() {
		showTopicChange = false;
		newPersona = '';
	}

	function randomizeNewPersona() {
		let newTopic;
		do {
			const randomIndex = Math.floor(Math.random() * TOPICS.length);
			newTopic = TOPICS[randomIndex];
		} while (newTopic === newPersona && TOPICS.length > 1);
		newPersona = newTopic;
	}

	async function confirmTopicChange() {
		if (!newPersona.trim()) return;
		persona = newPersona.trim();
		showTopicChange = false;
		newPersona = '';
		sessionId = '';
		messages = [];
		userMessageCount = 0;
		await startSession();
	}

	interface ChatMessage {
		id: string;
		role: string;
		content: string;
		correction?: string | null;
		correctionType?: 'correction' | 'feedback';
		feedbackText?: string;
		eloUpdates?: boolean;
		vocabularyUpdates?: any[];
		extraVocabLemmas?: string[];
	}

	let messages: ChatMessage[] = [];
	let userMessageCount = 0;

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
		userMessageCount = 0;
		scrollToBottom();
	}

	async function sendMessage() {
		if (!message.trim() || isLoading) return;

		const userMessageText = message;
		message = '';

		userMessageCount += 1;
		const isFirstMessage = userMessageCount === 1;

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
					language,
					assignmentId: isAssignment && assignment ? assignment.id : undefined
				})
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to send message');
			}

			const reader = res.body?.getReader();
			if (!reader) throw new Error('No response stream');

			isTyping = true;

			const decoder = new TextDecoder();
			let buffer = '';
			let _fullContent = '';

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
						console.log('Parsed event:', event);
						if (event.type === 'metadata') {
							if (!sessionId) {
								sessionId = event.sessionId;
							}
						} else if (event.type === 'chunk') {
							_fullContent += event.content;
						} else if (event.type === 'done') {
							isTyping = false;
							const grading = event.grading || {};
							const hasEloUpdates =
								(grading.vocabularyUpdates && grading.vocabularyUpdates.length > 0) ||
								(grading.extraVocabLemmas && grading.extraVocabLemmas.length > 0);
							messages = [
								...messages,
								{
									id: Date.now().toString() + '-ai',
									role: 'assistant',
									content: event.message.message || event.message.content || '',
									correction: isFirstMessage ? null : parseCorrection(event.message.correction),
									correctionType: grading.correctionType || 'correction',
									feedbackText: event.message.correction || '',
									eloUpdates: hasEloUpdates,
									vocabularyUpdates: grading.vocabularyUpdates,
									extraVocabLemmas: grading.extraVocabLemmas
								}
							];
							if (grading.assignmentCompleted) {
								isPassed = true;
							}
							if (isAssignment) {
								messagesSent += 1;
							}
							scrollToBottom();
						}
					} catch (_) {
						// ignore parse errors for partial lines
					}
				}
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

			isTyping = true;

			const decoder = new TextDecoder();
			let buffer = '';
			let _fullContent = '';

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
						console.log('Parsed event:', event);
						if (event.type === 'metadata') {
							if (!sessionId) {
								sessionId = event.sessionId;
							}
						} else if (event.type === 'chunk') {
							_fullContent += event.content;
						} else if (event.type === 'done') {
							isTyping = false;
							messages = [
								...messages,
								{
									id: Date.now().toString() + '-ai',
									role: 'assistant',
									content: event.message.content || '',
									correction: null
								}
							];
							scrollToBottom();
						}
					} catch (_) {
						// ignore parse errors for partial lines
					}
				}
			}

			if (buffer.trim()) {
				console.log('Flushing buffer (AI):', buffer);
				try {
					const event = JSON.parse(buffer.trim());
					if (event.type === 'done') {
						isTyping = false;
						messages = [
							...messages,
							{
								id: Date.now().toString() + '-ai',
								role: 'assistant',
								content: event.message.content || '',
								correction: null
							}
						];
						scrollToBottom();
					}
				} catch (_) {
					/* ignore partial JSON parse errors */
				}
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

<svelte:head>
	<title>AI Chat Practice - LingoLearn</title>
</svelte:head>

<div class="chat-container">
	{#if isAssignment}
		<div class="assignment-banner {isPassed ? 'passed' : ''}">
			<div class="banner-content">
				<div class="banner-info">
					<h3>Assignment: {assignment?.title || 'Chat Practice'}</h3>
					<p>Topic: {assignment?.topic || persona}</p>
				</div>
				<div class="banner-progress">
					{#if isPassed}
						<div class="success-badge">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="icon"
								><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline
									points="22 4 12 14.01 9 11.01"
								></polyline></svg
							>
							Passed
						</div>
						<button
							class="back-btn"
							onclick={() => assignment && goto(`/classes/${assignment.classId}`)}
							>Back to Class</button
						>
					{:else}
						<div class="progress-text">Messages: {messagesSent} / {targetScore}</div>
						<div class="progress-bar-bg">
							<div
								class="progress-bar-fill"
								style="width: {Math.min(100, Math.round((messagesSent / targetScore) * 100))}%"
							></div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<div class="chat-header-main" in:fly={{ y: 20, duration: 400 }}>
		<a href="/play" class="back-nav">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg
			>
			Back to Play
		</a>
		<h1>
			<svg
				class="ai-title-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				><path
					d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
				/></svg
			>
			AI Chat Practice
		</h1>
	</div>

	{#if !sessionStarted}
		<div class="card-duo setup-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<h2>Start a new roleplay</h2>
			<div class="form-group">
				<div>
					<div class="label-row">
						<label for="persona">Persona / Scenario</label>
						<button class="randomize-btn" onclick={randomizeTopic} title="Randomize Topic">
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
				<button
					type="button"
					onclick={startSession}
					class="btn-duo btn-ai start-btn"
					aria-label="Start conversation"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						style="width:1.5rem;height:1.5rem;flex-shrink:0;margin-right:0.5rem;"
						><path
							d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
						/></svg
					>
					Start Conversation
				</button>
			</div>
		</div>
	{:else}
		<div class="card-duo chat-box" in:fly={{ y: 20, duration: 400, delay: 100 }}>
			<!-- Header -->
			<div class="chat-header">
				<div class="persona-info">
					<div class="persona-name-row">
						<span class="persona-name">{persona}</span>
						<span class="ai-badge">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								style="width:0.7rem;height:0.7rem;"
								><path
									d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
								/></svg
							>
							AI
						</span>
						{#if !isAssignment && userMessageCount > 0}
							<span class="turn-counter">Turn {userMessageCount}</span>
						{/if}
					</div>
					<span class="persona-lang">{language}</span>
				</div>
				{#if !isAssignment}
					<div class="session-actions">
						<button onclick={openTopicChange} class="change-topic-btn" disabled={showTopicChange}>
							Change Topic
						</button>
						<button
							onclick={() => {
								sessionStarted = false;
								sessionId = '';
								showTopicChange = false;
							}}
							class="end-session-btn"
						>
							End Session
						</button>
					</div>
				{/if}
			</div>

			{#if showTopicChange}
				<div class="topic-change-bar">
					<input
						type="text"
						bind:value={newPersona}
						class="topic-change-input"
						placeholder="Enter a new persona or topic..."
						onkeydown={(e) => e.key === 'Enter' && confirmTopicChange()}
					/>
					<button onclick={randomizeNewPersona} class="randomize-inline-btn" title="Randomize">
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							style="width:1rem;height:1rem;"
							><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline
								points="21 16 21 21 16 21"
							/><line x1="15" y1="15" x2="21" y2="21" /></svg
						>
					</button>
					<button
						onclick={confirmTopicChange}
						class="confirm-topic-btn"
						disabled={!newPersona.trim() || isLoading}
					>
						Start
					</button>
					<button onclick={cancelTopicChange} class="cancel-topic-btn"> Cancel </button>
				</div>
			{/if}

			<!-- Messages Area -->
			<div class="messages-area" bind:this={chatContainer}>
				<div class="messages-list">
					{#if messages.length === 0}
						<div class="empty-state">
							<div class="wave">👋</div>
							<p>Start the conversation! Introduce yourself or say hello.</p>
							<button onclick={startAIConversation} class="ai-start-btn" disabled={isLoading}>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									style="width:1rem;height:1rem;flex-shrink:0;"
									><path
										d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
									/></svg
								>
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
									{#if msg.content}
										<p>{msg.content}</p>
									{:else}
										<span class="typing-dots"><span></span><span></span><span></span></span>
									{/if}
								</div>

								{#if msg.feedbackText}
									<div class="feedback-box">
										<p>{msg.feedbackText}</p>
									</div>
								{/if}
								{#if msg.eloUpdates}
									<div class="elo-badge">
										+ ELO Updated
										{#if (msg.vocabularyUpdates && msg.vocabularyUpdates.length > 0) || (msg.extraVocabLemmas && msg.extraVocabLemmas.length > 0)}
											<span class="elo-details">
												({[
													...(msg.vocabularyUpdates || []).map((u) => u.lemma || 'Vocab'),
													...(msg.extraVocabLemmas || [])
												].join(', ')})
											</span>
										{/if}
									</div>
								{/if}
								{#if msg.correction}
									<div
										class="correction-box"
										class:correction-is-feedback={msg.correctionType === 'feedback'}
									>
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
											{msg.correctionType === 'feedback' ? 'Feedback' : 'Correction'}
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
				<SpecialCharKeyboard bind:value={message} inputElement={chatInputRef} {language} />
				<div class="input-wrapper">
					<div class="textarea-container">
						<textarea
							bind:this={chatInputRef}
							bind:value={message}
							onkeydown={handleKeydown}
							placeholder="Type your message... (Enter to send)"
							rows="1"
							disabled={isLoading || isPassed}
						></textarea>
					</div>
					<button
						type="button"
						onclick={sendMessage}
						disabled={isLoading || !message.trim() || isPassed}
						class="send-btn"
						aria-label="Send message"
					>
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
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.chat-header-main h1 {
		font-size: 1.875rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
	}

	.ai-title-icon {
		width: 2.25rem;
		height: 2.25rem;
		color: #8b5cf6;
		flex-shrink: 0;
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
		color: #1cb0f6;
		background-color: var(--link-hover-bg, #ddf4ff);
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
		border-color: #8b5cf6;
	}

	.start-btn {
		margin-top: 1rem;
		width: 100%;
		font-size: 1.125rem;
	}

	.chat-box {
		display: flex;
		height: 600px;
		flex-direction: column;
		overflow: hidden;
		padding: 0;
		transform: none !important;
		box-shadow: 0 4px 0 var(--card-border, #e5e7eb) !important;
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 2px solid var(--card-border, #e5e7eb);
		background-color: var(--header-bg, #f8fafc);
		padding: 1rem 1.5rem;
	}

	.persona-info {
		display: flex;
		flex-direction: column;
	}

	.persona-name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.persona-name {
		font-weight: 700;
	}

	.ai-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		background-color: #f5f3ff;
		color: #8b5cf6;
		border: 1px solid #ddd6fe;
		border-radius: 9999px;
		padding: 0.125rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	:global(html[data-theme='dark']) .ai-badge {
		background-color: #2e1065;
		color: #a78bfa;
		border-color: #6d28d9;
	}

	.turn-counter {
		display: inline-flex;
		align-items: center;
		background-color: #f0fdf4;
		color: #15803d;
		border: 1px solid #bbf7d0;
		border-radius: 9999px;
		padding: 0.1rem 0.5rem;
		font-size: 0.7rem;
		font-weight: 700;
	}

	:global(html[data-theme='dark']) .turn-counter {
		background-color: rgba(20, 83, 45, 0.3);
		color: #4ade80;
		border-color: rgba(74, 222, 128, 0.3);
	}

	.persona-lang {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary, #64748b);
	}

	.session-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.change-topic-btn {
		border-radius: 9999px;
		background-color: #eff6ff;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 700;
		color: #1d4ed8;
		transition: background-color 0.2s;
		border: 1px solid #bfdbfe;
		cursor: pointer;
	}

	.change-topic-btn:hover:not(:disabled) {
		background-color: #dbeafe;
	}

	.change-topic-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(html[data-theme='dark']) .change-topic-btn {
		background-color: rgba(30, 58, 138, 0.3);
		color: #93c5fd;
		border-color: rgba(147, 197, 253, 0.3);
	}

	.end-session-btn {
		border-radius: 9999px;
		background-color: var(--card-border, #e2e8f0);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text-color, #475569);
		transition: background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.end-session-btn:hover {
		background-color: #cbd5e1;
	}

	.topic-change-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background-color: #f8fafc;
		border-bottom: 1px solid var(--card-border, #e2e8f0);
	}

	:global(html[data-theme='dark']) .topic-change-bar {
		background-color: #1e293b;
		border-color: #334155;
	}

	.topic-change-input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-family: inherit;
		background-color: white;
		color: #0f172a;
		min-width: 0;
	}

	.topic-change-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	:global(html[data-theme='dark']) .topic-change-input {
		background-color: var(--input-bg, #2a303c);
		border-color: var(--input-border, #3a4150);
		color: var(--input-text, #e2e8f0);
	}

	.randomize-inline-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.5rem;
		background-color: #f1f5f9;
		border: 1px solid #e2e8f0;
		color: #64748b;
		cursor: pointer;
		flex-shrink: 0;
		transition: background-color 0.15s;
	}

	.randomize-inline-btn:hover {
		background-color: #e2e8f0;
	}

	:global(html[data-theme='dark']) .randomize-inline-btn {
		background-color: #1e293b;
		border-color: #334155;
		color: #94a3b8;
	}

	.confirm-topic-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		background-color: #22c55e;
		color: white;
		font-size: 0.875rem;
		font-weight: 700;
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 0.15s;
		flex-shrink: 0;
	}

	.confirm-topic-btn:hover:not(:disabled) {
		background-color: #16a34a;
	}

	.confirm-topic-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-topic-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background-color: transparent;
		color: #94a3b8;
		font-size: 0.875rem;
		font-weight: 600;
		border: none;
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s;
		flex-shrink: 0;
	}

	.cancel-topic-btn:hover {
		color: #64748b;
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
		color: var(--text-secondary, #64748b);
	}

	.ai-start-btn {
		margin-top: 1.5rem;
		display: inline-flex;
		align-items: center;
		gap: 0.625rem;
		font-size: 0.9375rem;
		padding: 0.75rem 1.25rem;
		background-color: var(--card-bg, #ffffff);
		color: #8b5cf6;
		border: 2px solid #8b5cf6;
		border-radius: 0.75rem;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.2s;
	}

	.ai-start-btn:hover:not(:disabled) {
		background-color: #f5f3ff;
	}

	.ai-start-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(html[data-theme='dark']) .ai-start-btn {
		background-color: var(--card-bg, #111827);
		color: #a78bfa;
		border-color: #8b5cf6;
	}

	:global(html[data-theme='dark']) .ai-start-btn:hover:not(:disabled) {
		background-color: #2e1065;
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
		background-color: #1cb0f6;
		color: white;
	}

	.bubble-assistant {
		border-bottom-left-radius: 0.125rem;
		border: 1px solid var(--card-border, #e2e8f0);
		background-color: var(--card-bg, #ffffff);
	}

	.typing-dots {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.125rem 0.25rem;
	}

	.typing-dots span {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background-color: #94a3b8;
		animation: typing-bounce 1.2s ease-in-out infinite;
	}

	.typing-dots span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing-dots span:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typing-bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		30% {
			transform: translateY(-0.35rem);
			opacity: 1;
		}
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
		border-top: 2px solid var(--card-border, #e5e7eb);
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
		border-color: #1cb0f6;
		background-color: var(--card-bg, #ffffff);
	}

	.textarea-container textarea:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.textarea-container textarea::placeholder {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .textarea-container textarea::placeholder {
		color: #4a5260;
	}

	:global(html[data-theme='dark']) .textarea-container textarea:focus {
		background-color: var(--card-bg, #21252e);
	}

	.send-btn {
		display: flex;
		height: 52px;
		width: 52px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
		background-color: #22c55e;
		color: white;
		box-shadow: 0 4px 0 #16a34a;
		transition:
			transform 0.1s,
			box-shadow 0.1s,
			background-color 0.2s;
		border: none;
		cursor: pointer;
	}

	.send-btn:hover:not(:disabled) {
		background-color: #4ade80;
		box-shadow: 0 4px 0 #16a34a;
	}

	.send-btn:active:not(:disabled) {
		transform: translateY(4px);
		box-shadow: 0 0 0 #16a34a;
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

	.correction-is-feedback {
		border-color: #bbf7d0;
		background-color: #f0fdf4;
		color: #14532d;
	}

	.correction-is-feedback .correction-header {
		color: #15803d;
	}

	:global(html[data-theme='dark']) .correction-box {
		border-color: rgba(124, 45, 18, 0.5);
		background-color: rgba(124, 45, 18, 0.2);
		color: #fed7aa;
	}

	:global(html[data-theme='dark']) .correction-box.correction-is-feedback {
		border-color: rgba(74, 222, 128, 0.3);
		background-color: rgba(20, 83, 45, 0.2);
		color: #bbf7d0;
	}

	:global(html[data-theme='dark']) .correction-header {
		color: #fb923c;
	}

	:global(html[data-theme='dark']) .correction-is-feedback .correction-header {
		color: #4ade80;
	}

	.assignment-banner {
		background-color: var(--card-bg, #ffffff);
		border-bottom: 1px solid var(--card-border, #e2e8f0);
		padding: 1rem 1.5rem;
		border-radius: 0.75rem 0.75rem 0 0;
		margin-bottom: 0;
	}
	.assignment-banner.passed {
		background-color: #f0fdf4;
		border-color: #bbf7d0;
	}
	:global(html[data-theme='dark']) .assignment-banner.passed {
		background-color: rgba(22, 101, 52, 0.2);
		border-color: rgba(21, 128, 61, 0.5);
	}
	.banner-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}
	.banner-info h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1.125rem;
		font-weight: 700;
	}
	.banner-info p {
		margin: 0;
		font-size: 0.875rem;
		color: #64748b;
	}
	.banner-progress {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.success-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #16a34a;
		font-weight: 700;
	}
	.back-btn {
		padding: 0.5rem 1rem;
		background-color: #16a34a;
		color: white;
		border-radius: 0.5rem;
		border: none;
		font-weight: 600;
		cursor: pointer;
	}
	.progress-text {
		font-size: 0.875rem;
		font-weight: 600;
	}
	.progress-bar-bg {
		width: 100px;
		height: 8px;
		background-color: #e2e8f0;
		border-radius: 4px;
		overflow: hidden;
	}
	.progress-bar-fill {
		height: 100%;
		background-color: #1cb0f6;
		transition: width 0.3s ease;
	}
	.feedback-box {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: #475569;
		background: #f1f5f9;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
	}
	:global(html[data-theme='dark']) .feedback-box {
		background: #334155;
		color: #cbd5e1;
	}
	.elo-badge {
		display: inline-block;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		color: #059669;
		background: #d1fae5;
		padding: 0.25rem 0.5rem;
		border-radius: 1rem;
	}
	.elo-details {
		font-weight: 500;
		opacity: 0.9;
		margin-left: 0.25rem;
	}
	:global(html[data-theme='dark']) .elo-badge {
		background: rgba(5, 150, 105, 0.2);
		color: #34d399;
	}
</style>
