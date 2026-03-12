<script lang="ts">
	export let challenge: any;
	export let submitting: boolean;
	export let feedback: any;
	export let loading: boolean;
	export let shuffledChoices: string[];
	export let selectedChoice: string | null;
	export let hasSubmittedMc: boolean;
	export let submitAnswer: () => void;
</script>

<div class="mc-choices">
	{#each shuffledChoices as choice}
		<button
			type="button"
			class="mc-choice-btn dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
			class:selected={selectedChoice === choice}
			class:correct={(feedback || hasSubmittedMc) &&
				choice === challenge.targetSentence}
			class:incorrect={(feedback || hasSubmittedMc) &&
				selectedChoice === choice &&
				choice !== challenge.targetSentence}
			disabled={submitting || feedback !== null || loading || hasSubmittedMc}
			on:click={() => {
				selectedChoice = choice;
				submitAnswer();
			}}
		>
			{choice.replace(/<vocab[^>]*>/g, '').replace(/<\/vocab>/g, '')}
		</button>
	{/each}
</div>

<style>
	.mc-choices {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mc-choice-btn {
		width: 100%;
		padding: 1rem 1.25rem;
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 1rem;
		background: var(--card-bg, #ffffff);
		color: var(--text-color, #1e293b);
		font-size: 1.05rem;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	.mc-choice-btn:hover:not(:disabled) {
		border-color: #93c5fd;
		background: #eff6ff;
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #93c5fd;
	}

	:global(html[data-theme='dark']) .mc-choice-btn:hover:not(:disabled) {
		background: #1e293b;
		border-color: #3b82f6;
		box-shadow: 0 6px 0 #1e3a5f;
	}

	.mc-choice-btn.selected {
		border-color: #1cb0f6;
		background: #ddf4ff;
		color: #1cb0f6;
		transform: translateY(2px);
		box-shadow: 0 2px 0 #1899d6;
	}

	:global(html[data-theme='dark']) .mc-choice-btn.selected {
		background: #0c2340;
		color: #38bdf8;
		box-shadow: 0 2px 0 #0e4166;
	}

	.mc-choice-btn.correct {
		border-color: #16a34a;
		background: #f0fdf4;
		color: #166534;
		box-shadow: 0 2px 0 #15803d;
	}

	:global(html[data-theme='dark']) .mc-choice-btn.correct {
		background: #052e16;
		color: #86efac;
		box-shadow: 0 2px 0 #14532d;
	}

	.mc-choice-btn.incorrect {
		border-color: #dc2626;
		background: #fef2f2;
		color: #991b1b;
		box-shadow: 0 2px 0 #b91c1c;
	}

	:global(html[data-theme='dark']) .mc-choice-btn.incorrect {
		background: #450a0a;
		color: #fca5a5;
		box-shadow: 0 2px 0 #7f1d1d;
	}

	.mc-choice-btn:disabled {
		cursor: default;
		opacity: 0.85;
		transform: translateY(2px);
		box-shadow: 0 2px 0 var(--card-border, #e2e8f0);
	}
</style>
