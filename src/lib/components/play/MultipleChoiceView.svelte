<script lang="ts">
	let {
		challenge,
		submitting,
		feedback,
		loading,
		shuffledChoices,
		selectedChoice = $bindable(null),
		hasSubmittedMc,
		submitAnswer
	}: {
		challenge: any;
		submitting: boolean;
		feedback: any;
		loading: boolean;
		shuffledChoices: string[];
		selectedChoice: string | null;
		hasSubmittedMc: boolean;
		submitAnswer: () => void;
	} = $props();

	const isDisabled = $derived(submitting || feedback !== null || loading || hasSubmittedMc);

	function handleKeydown(e: KeyboardEvent) {
		if (isDisabled) return;
		// Ignore when typing in an input/textarea
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		if (tag === 'input' || tag === 'textarea') return;

		const keyMap: Record<string, number> = {
			'1': 0, 'a': 0,
			'2': 1, 'b': 1,
			'3': 2, 'c': 2,
			'4': 3, 'd': 3
		};
		const idx = keyMap[e.key.toLowerCase()];
		if (idx !== undefined && idx < shuffledChoices.length) {
			e.preventDefault();
			selectedChoice = shuffledChoices[idx];
			submitAnswer();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="mc-choices">
	{#each shuffledChoices as choice, i}
		<button
			type="button"
			class="mc-choice-btn"
			class:selected={selectedChoice === choice}
			class:correct={(feedback || hasSubmittedMc) &&
				choice === challenge.targetSentence}
			class:incorrect={(feedback || hasSubmittedMc) &&
				selectedChoice === choice &&
				choice !== challenge.targetSentence}
			disabled={isDisabled}
			onclick={() => {
				selectedChoice = choice;
				submitAnswer();
			}}
		>
			{#if !isDisabled}
				<span class="mc-key-hint">{i + 1}</span>
			{/if}
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
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.mc-key-hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.4rem;
		height: 1.4rem;
		font-size: 0.7rem;
		font-weight: 800;
		background: var(--card-border, #e2e8f0);
		color: #64748b;
		border-radius: 0.3rem;
		flex-shrink: 0;
		letter-spacing: 0;
	}

	:global(html[data-theme='dark']) .mc-key-hint {
		background: #334155;
		color: #94a3b8;
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
		background: rgba(20, 83, 45, 0.3);
		color: #86efac;
		box-shadow: 0 2px 0 rgba(20, 83, 45, 0.5);
	}

	.mc-choice-btn.incorrect {
		border-color: #dc2626;
		background: #fef2f2;
		color: #991b1b;
		box-shadow: 0 2px 0 #b91c1c;
	}

	:global(html[data-theme='dark']) .mc-choice-btn.incorrect {
		background: rgba(127, 29, 29, 0.3);
		color: #fca5a5;
		box-shadow: 0 2px 0 rgba(127, 29, 29, 0.5);
	}

	.mc-choice-btn:disabled {
		cursor: default;
		opacity: 0.85;
		transform: translateY(2px);
		box-shadow: 0 2px 0 var(--card-border, #e2e8f0);
	}
</style>
