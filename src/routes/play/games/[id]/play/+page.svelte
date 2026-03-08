<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let currentQuestionIndex = $state(0);
	let score = $state(0);
	let isGameOver = $state(false);
	let selectedOption: string | null = $state(null);
	let isAnswerCorrect: boolean | null = $state(null);
	let showResult = $state(false);

	let game = $derived(data.game);
	let questions = $derived(game.questions || []);
	let currentQuestion = $derived(questions[currentQuestionIndex]);
	let options = $derived.by(() => {
		const rawOptions = Array.isArray(currentQuestion?.options) 
			? currentQuestion.options 
			: (typeof currentQuestion?.options === 'string' 
				? JSON.parse(currentQuestion.options) 
				: []);
				
		if (!currentQuestion) return [];
		
		// Ensure answer is in options, but not duplicated
		const opts = [...rawOptions].filter(opt => opt !== currentQuestion.answer);
		opts.push(currentQuestion.answer);
		
		// Shuffle options
		for (let i = opts.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[opts[i], opts[j]] = [opts[j], opts[i]];
		}
		
		return opts;
	});

	function selectOption(option: string) {
		if (showResult) return;

		selectedOption = option;
		isAnswerCorrect = option === currentQuestion.answer;
		if (isAnswerCorrect) {
			score++;
		}
		showResult = true;
	}

	function nextQuestion() {
		if (currentQuestionIndex < questions.length - 1) {
			currentQuestionIndex++;
			selectedOption = null;
			isAnswerCorrect = null;
			showResult = false;
		} else {
			isGameOver = true;
		}
	}
</script>

<div class="learn-container">
	{#if isGameOver}
		<div class="card-duo game-over-card">
			<h1>Game Over!</h1>
			<p class="score-text">
				Your Score: {score} / {questions.length}
			</p>
			<a href="/play?tab=games" class="btn-primary link-btn-primary">Return to Games</a>
		</div>
	{:else if currentQuestion}
		<div class="game-header">
			<h1>{game.title}</h1>
			<div class="progress-badge">Question {currentQuestionIndex + 1} of {questions.length}</div>
		</div>

		<div class="card-duo question-card">
			<h2 class="question-text">{currentQuestion.question}</h2>

			<div class="options-grid">
				{#each options as option}
					<button
						class="option-btn {showResult && option === currentQuestion.answer ? 'correct-btn' : showResult && option === selectedOption && option !== currentQuestion.answer ? 'incorrect-btn' : ''}"
						onclick={() => selectOption(option)}
						disabled={showResult}
					>
						{option}
					</button>
				{/each}
			</div>

			{#if showResult}
				<div class="result-section">
					<div class="result-message">
						{#if isAnswerCorrect}
							<span class="text-success">Correct!</span>
						{:else}
							<span class="text-error">Incorrect!</span> The correct answer is {currentQuestion.answer}.
						{/if}
					</div>
					<button class="btn-primary next-btn" onclick={nextQuestion}>
						{currentQuestionIndex === questions.length - 1 ? 'Finish Game' : 'Next Question'}
					</button>
				</div>
			{/if}
		</div>
	{:else}
		<div class="card-duo empty-card">
			<h1>No questions available for this game.</h1>
			<a href="/play?tab=games" class="btn-primary link-btn-primary mt-4">Return to Games</a>
		</div>
	{/if}
</div>

<style>
	.learn-container {
		max-width: 42rem; /* 2xl */
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.card-duo {
		padding: 2rem;
		text-align: center;
	}

	.game-over-card h1 {
		font-size: 2.5rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0 0 1rem;
	}

	.score-text {
		font-size: 1.5rem;
		color: #475569;
		margin: 0 0 2rem;
	}

	.link-btn-primary {
		display: inline-block;
		text-decoration: none;
		padding: 0.75rem 1.5rem;
		border-radius: 0.75rem;
		font-weight: bold;
	}

	.mt-4 {
		margin-top: 1rem;
	}

	.game-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.game-header h1 {
		font-size: 2rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0 0 0.5rem;
	}

	.progress-badge {
		display: inline-block;
		background-color: #f1f5f9;
		color: #475569;
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.875rem;
		font-weight: bold;
	}

	.question-card {
		padding: 1.5rem;
	}

	@media (min-width: 640px) {
		.question-card {
			padding: 2rem;
		}
	}

	.question-text {
		font-size: 1.25rem;
		font-weight: bold;
		margin: 0 0 1.5rem;
		color: var(--text-color, #1e293b);
	}

	.options-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.options-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.option-btn {
		min-height: 4rem;
		padding: 1rem;
		font-size: 1.125rem;
		border-radius: 0.75rem;
		background-color: white;
		border: 2px solid #cbd5e1;
		color: #334155;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 2px 0 #cbd5e1;
	}

	.option-btn:not(:disabled):hover {
		border-color: #3b82f6;
		color: #1d4ed8;
		transform: translateY(-2px);
		box-shadow: 0 4px 0 #3b82f6;
	}

	.option-btn:not(:disabled):active {
		transform: translateY(0);
		box-shadow: 0 2px 0 #3b82f6;
	}

	.option-btn:disabled {
		cursor: default;
	}

	.correct-btn {
		background-color: #dcfce7 !important;
		border-color: #22c55e !important;
		color: #15803d !important;
		box-shadow: 0 2px 0 #16a34a !important;
	}

	.incorrect-btn {
		background-color: #fee2e2 !important;
		border-color: #ef4444 !important;
		color: #b91c1c !important;
		box-shadow: 0 2px 0 #dc2626 !important;
	}

	.result-section {
		margin-top: 2rem;
		padding-top: 2rem;
		border-top: 2px dashed #e2e8f0;
	}

	.result-message {
		font-size: 1.25rem;
		font-weight: bold;
		margin-bottom: 1rem;
		color: #334155;
	}

	.text-success {
		color: #16a34a;
	}

	.text-error {
		color: #dc2626;
	}

	.next-btn {
		padding: 0.75rem 2rem;
		border-radius: 0.75rem;
		font-size: 1.125rem;
		font-weight: bold;
	}

	.empty-card h1 {
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--text-color, #1e293b);
		margin: 0 0 1rem;
	}
</style>
