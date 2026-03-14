<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import { toast } from '$lib/toast';

	let session: any = null;
	let interval: any;
	let loading = true;
	let joined = false;
	let currentUserId = '';
	let shuffledOptions: any[] = [];
	let lastQuestionId = '';
	let lastAnswerCorrect: boolean | null = null;

	$: currentQuestionData = session?.game?.questions?.[session?.currentQuestionIndex || 0] || null;
	$: me = session?.participants?.find((p: any) => p.userId === currentUserId) || null;
	$: hasAnswered = me?.hasAnswered || false;
	$: myScore = me?.score || 0;

	$: if (currentQuestionData && currentQuestionData.id !== lastQuestionId) {
		lastQuestionId = currentQuestionData.id;
		const rawOptions = Array.isArray(currentQuestionData.options) 
			? currentQuestionData.options 
			: (typeof currentQuestionData.options === 'string' 
				? JSON.parse(currentQuestionData.options) 
				: []);
		const opts = [...rawOptions].filter(o => o !== currentQuestionData.answer);
		opts.push(currentQuestionData.answer);
		
		// Fisher-Yates shuffle
		for (let i = opts.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[opts[i], opts[j]] = [opts[j], opts[i]];
		}
		
		shuffledOptions = opts.map(text => ({ text }));
	}

	const classId = $page.params.id;

	async function fetchSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session`);
			const data = await res.json();

			if (data.userId) currentUserId = data.userId;

			if (data.session) {
				session = data.session;
				loading = false;
				
				// check if joined
				if (session.participants?.some((p: any) => p.userId === currentUserId)) {
					joined = true;
				}

			} else {
				session = null;
				joined = false;
			}
		} catch (error) {
			console.error(error);
		}
	}

	async function joinSession() {
		try {
			const res = await fetch(`/api/classes/${classId}/live-session/student`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'join' })
			});
			if (!res.ok) throw new Error('Failed to join session');
			joined = true;
			fetchSession();
		} catch (error: any) {
			toast.error(error.message);
		}
	}

	async function submitAnswer(selectedText: string) {
		if (hasAnswered) return;
		try {
			const res = await fetch(`/api/classes/${classId}/live-session/student`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'answer', selectedAnswer: selectedText })
			});
			if (!res.ok) throw new Error('Failed to submit answer');
			const result = await res.json();
			lastAnswerCorrect = result.isCorrect ?? false;

			fetchSession();
			toast.success(result.isCorrect ? 'Correct!' : 'Incorrect!');
		} catch (error: any) {
			toast.error(error.message);
		}
	}

	onMount(() => {
		fetchSession();
		interval = setInterval(fetchSession, 2000); // Polling every 2s
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	function handleKeydown(e: KeyboardEvent) {
		if (hasAnswered || session?.status !== 'active' || !currentQuestionData) return;
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;
		const keyMap: Record<string, number> = { '1': 0, 'a': 0, '2': 1, 'b': 1, '3': 2, 'c': 2, '4': 3, 'd': 3 };
		const idx = keyMap[e.key.toLowerCase()];
		if (idx !== undefined && idx < shuffledOptions.length) {
			e.preventDefault();
			submitAnswer(shuffledOptions[idx].text);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="live-container">
	<h1 class="battle-title pulse">Classroom Battle</h1>

	{#if loading && !session}
		<p class="status-text">Looking for active session...</p>
	{:else if !session || session.status === 'finished'}
		<div class="battle-card">
			<h2 class="card-title">No active session right now.</h2>
			<p class="card-desc">Wait for your teacher to start the battle.</p>
		</div>
	{:else if !joined}
		<div class="battle-card">
			<h2 class="card-title mb-large">Battle is ready!</h2>
			<button class="btn-primary w-full btn-large" onclick={joinSession}> Join Now </button>
		</div>
	{:else}
		<div class="battle-card relative overflow-hidden">
			<!-- Simple Background Animation -->
			<div class="bg-gradient"></div>

			{#if session.status === 'waiting'}
				<h2 class="card-title">Waiting for teacher to start...</h2>
				<p class="card-desc mb-large">Get ready!</p>
				<div class="spinner"></div>
			{:else if session.status === 'active' || session.status === 'showing_answer'}
				<div class="score-board">
					<p class="score-text">My Score: <span class="score-value">{myScore}</span></p>
				</div>

				{#if session.game?.questions?.length > 1}
					<div class="live-progress-bar">
						<div class="live-progress-fill" style="width: {(((session.currentQuestionIndex || 0)) / session.game.questions.length) * 100}%"></div>
					</div>
					<p class="live-progress-label">Question {(session.currentQuestionIndex || 0) + 1} of {session.game.questions.length}</p>
				{/if}

				<h2 class="question-title">
					{currentQuestionData?.question || 'Get Ready!'}
				</h2>

				{#if session.status === 'showing_answer'}
					<div class="reveal-state {hasAnswered && lastAnswerCorrect ? 'correct' : 'incorrect'}">
						<h3>{hasAnswered ? (lastAnswerCorrect ? 'Correct!' : 'Incorrect!') : 'Time is up!'}</h3>
						<p>The correct answer is: <strong>{currentQuestionData?.answer}</strong></p>
					</div>
				{:else if hasAnswered}
					<div class="answered-state">
						<h3>Answer submitted!</h3>
						<p>Waiting for the next question...</p>
						<div class="spinner"></div>
					</div>
				{:else if currentQuestionData}
					<div class="options-grid">
						{#each shuffledOptions as opt, i}
							{@const optionColors = ['a', 'b', 'c', 'd', 'a', 'b']}
							<button
								type="button"
								class={`option-btn option-${optionColors[i % optionColors.length]}`}
								onclick={() => submitAnswer(opt.text)}
								disabled={hasAnswered}
								aria-label="Answer option: {opt.text}"
							>
								{#if !hasAnswered}<span class="live-key-hint">{i + 1}</span>{/if}
								{opt.text}
							</button>
						{/each}
					</div>

					<p class="hint-text">Select the correct answer. Faster answers give more points!</p>
				{:else}
					<p class="hint-text">Waiting for the next question...</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.live-container {
		max-width: 42rem;
		margin: 0 auto;
		padding: 2rem 1rem;
		text-align: center;
		font-family: inherit;
	}

	.battle-title {
		font-size: 2.5rem;
		font-weight: 800;
		margin-bottom: 2rem;
		color: #3b82f6;
	}

	.pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.status-text {
		font-size: 1.25rem;
		color: #64748b;
	}

	.battle-card {
		background-color: #ffffff;
		color: #0f172a;
		padding: 2rem;
		border-radius: 1rem;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);
		border: 1px solid #e2e8f0;
	}

	.card-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 1rem;
		margin-top: 0;
	}

	.card-desc {
		color: #64748b;
		margin: 0;
	}

	.mb-large {
		margin-bottom: 1.5rem;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		font-weight: 700;
		transition:
			background-color 0.2s,
			transform 0.1s;
		box-shadow: 0 4px 0 #2563eb;
	}

	.btn-primary:hover {
		background-color: #2563eb;
		transform: translateY(-1px);
	}

	.btn-primary:active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #2563eb;
	}

	.btn-large {
		padding: 1rem 2rem;
		font-size: 1.25rem;
	}

	.w-full {
		width: 100%;
	}

	.relative {
		position: relative;
	}

	.overflow-hidden {
		overflow: hidden;
	}

	.bg-gradient {
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		background: linear-gradient(to bottom right, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1));
		z-index: 0;
		pointer-events: none;
	}

	.spinner {
		border: 4px solid rgba(0, 0, 0, 0.1);
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border-left-color: #3b82f6;
		animation: spin 1s linear infinite;
		margin: 0 auto;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.question-title {
		font-size: 1.875rem;
		font-weight: 700;
		margin-bottom: 2rem;
		position: relative;
		z-index: 1;
	}

	.options-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
		position: relative;
		z-index: 1;
	}

	@media (max-width: 640px) {
		.options-grid {
			grid-template-columns: 1fr;
		}
	}

	.live-progress-bar {
		height: 4px;
		background: rgba(255, 255, 255, 0.2);
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 0.25rem;
	}

	.live-progress-fill {
		height: 100%;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	.live-progress-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.7);
		text-align: center;
		margin: 0 0 0.5rem;
	}

	.live-key-hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.4rem;
		height: 1.4rem;
		font-size: 0.7rem;
		font-weight: 800;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 0.3rem;
		flex-shrink: 0;
		margin-right: 0.5rem;
	}

	.option-btn {
		min-height: 8rem;
		padding: 1rem;
		font-size: 1.25rem;
		font-weight: 700;
		color: white;
		border: none;
		border-radius: 0.75rem;
		cursor: pointer;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transition: transform 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.option-btn:hover {
		transform: scale(1.05);
	}

	.option-btn:active {
		transform: scale(0.98);
	}

	.option-a {
		background-color: #ef4444;
		box-shadow: 0 4px 0 #b91c1c;
	}
	.option-b {
		background-color: #3b82f6;
		box-shadow: 0 4px 0 #1d4ed8;
	}
	.option-c {
		background-color: #eab308;
		box-shadow: 0 4px 0 #a16207;
	}
	.option-d {
		background-color: #22c55e;
		box-shadow: 0 4px 0 #15803d;
	}

	.option-a:active {
		box-shadow: 0 2px 0 #b91c1c;
	}
	.option-b:active {
		box-shadow: 0 2px 0 #1d4ed8;
	}
	.option-c:active {
		box-shadow: 0 2px 0 #a16207;
	}
	.option-d:active {
		box-shadow: 0 2px 0 #15803d;
	}

	.hint-text {
		font-size: 0.875rem;
		color: #64748b;
		position: relative;
		z-index: 1;
	}

	.score-board {
		background-color: #f1f5f9;
		border-radius: 0.5rem;
		padding: 0.5rem 1rem;
		display: inline-block;
		margin-bottom: 1.5rem;
		position: relative;
		z-index: 1;
		border: 1px solid #e2e8f0;
	}

	.score-text {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #475569;
	}

	.score-value {
		color: #3b82f6;
		font-weight: 800;
	}

	.answered-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 1rem;
		margin-bottom: 2rem;
		position: relative;
		z-index: 1;
	}

	.answered-state h3 {
		margin: 0;
		color: #16a34a;
		font-size: 1.5rem;
	}

	.answered-state p {
		margin: 0;
		color: #15803d;
	}

	.reveal-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 2rem;
		border-radius: 1rem;
		margin-bottom: 2rem;
		position: relative;
		z-index: 1;
	}

	.reveal-state.correct {
		background-color: #f0fdf4;
		border: 2px solid #22c55e;
	}

	.reveal-state.correct h3 {
		color: #16a34a;
		font-size: 2rem;
		margin: 0;
	}

	.reveal-state.incorrect {
		background-color: #fef2f2;
		border: 2px solid #ef4444;
	}

	.reveal-state.incorrect h3 {
		color: #dc2626;
		font-size: 2rem;
		margin: 0;
	}

	.reveal-state p {
		margin: 0;
		font-size: 1.25rem;
		color: #1f2937;
	}

	/* Dark mode */
	:global(html[data-theme='dark']) .status-text {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .battle-card {
		background-color: var(--card-bg, #21252e);
		color: var(--text-color, #e2e8f0);
		border-color: var(--card-border, #2d3340);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
	}

	:global(html[data-theme='dark']) .card-title {
		color: var(--text-color, #e2e8f0);
	}

	:global(html[data-theme='dark']) .card-desc {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .spinner {
		border-color: rgba(255, 255, 255, 0.1);
		border-left-color: #60a5fa;
	}

	:global(html[data-theme='dark']) .question-title {
		color: var(--text-color, #e2e8f0);
	}

	:global(html[data-theme='dark']) .hint-text {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .score-board {
		background-color: #2a303c;
		border-color: #3a4150;
	}

	:global(html[data-theme='dark']) .score-text {
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .answered-state {
		background-color: rgba(20, 83, 45, 0.2);
		border-color: rgba(74, 222, 128, 0.4);
	}

	:global(html[data-theme='dark']) .answered-state h3 {
		color: #4ade80;
	}

	:global(html[data-theme='dark']) .answered-state p {
		color: #86efac;
	}

	:global(html[data-theme='dark']) .reveal-state.correct {
		background-color: rgba(20, 83, 45, 0.2);
		border-color: #4ade80;
	}

	:global(html[data-theme='dark']) .reveal-state.correct h3 {
		color: #4ade80;
	}

	:global(html[data-theme='dark']) .reveal-state.incorrect {
		background-color: rgba(127, 29, 29, 0.2);
		border-color: #f87171;
	}

	:global(html[data-theme='dark']) .reveal-state.incorrect h3 {
		color: #f87171;
	}

	:global(html[data-theme='dark']) .reveal-state p {
		color: #cbd5e1;
	}
</style>
