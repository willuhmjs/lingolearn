<script lang="ts">
	let {
		effectiveCorrect,
		typedAnswer,
		correctMeaning,
		gender,
		plural,
		isSubmitting,
		ontoggleoverride,
		onsubmitnext
	}: {
		effectiveCorrect: boolean;
		typedAnswer: string;
		correctMeaning: string;
		gender: string | null;
		plural: string | null;
		isSubmitting: boolean;
		ontoggleoverride: () => void;
		onsubmitnext: () => void;
	} = $props();
</script>

<div class="answer-reveal">
	<!-- Grade Result Banner -->
	<div
		class="grade-banner"
		class:grade-correct={effectiveCorrect}
		class:grade-incorrect={!effectiveCorrect}
	>
		<div class="grade-icon">
			{#if effectiveCorrect}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			{:else}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{/if}
		</div>
		<span class="grade-label">{effectiveCorrect ? 'Correct' : 'Incorrect'}</span>
	</div>

	<!-- Answer Info -->
	<div class="answer-info">
		{#if typedAnswer}
			<div
				class="typed-answer-display"
				class:typed-correct={effectiveCorrect}
				class:typed-incorrect={!effectiveCorrect}
			>
				<span class="typed-label">Your answer</span>
				<span class="typed-text">{typedAnswer}</span>
			</div>
		{/if}
		<div class="correct-answer-display">
			<span class="correct-label">Correct answer</span>
			<p class="meaning-text">
				{correctMeaning || 'No meaning provided'}
			</p>
		</div>
		<div class="meta-tags">
			{#if gender}
				<span class="meta-tag">
					Gender: <strong>{gender}</strong>
				</span>
			{/if}
			{#if plural}
				<span class="meta-tag">
					Plural: <strong>{plural}</strong>
				</span>
			{/if}
		</div>
	</div>

	<!-- Actions -->
	<div class="action-row">
		<button
			class="btn-duo btn-override"
			onclick={ontoggleoverride}
			aria-label={effectiveCorrect ? 'Mark as incorrect' : 'Mark as correct'}
		>
			<span class="override-icon">&#x21A9;</span>
			{effectiveCorrect ? 'Mark as incorrect' : 'Mark as correct'}
		</button>
		<button class="btn-duo btn-primary btn-continue" onclick={onsubmitnext} disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : 'Continue'}
			{#if !isSubmitting}<span class="continue-hint">Space</span>{/if}
		</button>
	</div>
</div>

<style>
	.answer-reveal {
		animation: fadeIn 0.3s ease-out;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.grade-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		font-weight: 800;
		font-size: 1.125rem;
		animation: slide-in-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
	}

	@keyframes slide-in-bounce {
		0% {
			transform: translateY(-20px) scale(0.9);
			opacity: 0;
		}
		100% {
			transform: translateY(0) scale(1);
			opacity: 1;
		}
	}

	.grade-correct {
		background-color: #dcfce7;
		color: #15803d;
	}

	.grade-incorrect {
		background-color: #fee2e2;
		color: #dc2626;
	}

	:global(html[data-theme='dark']) .grade-correct {
		background-color: rgba(20, 83, 45, 0.35);
		color: #4ade80;
	}

	:global(html[data-theme='dark']) .grade-incorrect {
		background-color: rgba(127, 29, 29, 0.35);
		color: #f87171;
	}

	.grade-icon {
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
	}

	.grade-icon svg {
		width: 100%;
		height: 100%;
	}

	.grade-label {
		font-size: 1.25rem;
	}

	.answer-info {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.typed-answer-display {
		padding: 0.75rem 1.25rem;
		border-radius: 1rem;
		border: 2px solid;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.typed-correct {
		background-color: #f0fdf4;
		border-color: #86efac;
	}

	.typed-incorrect {
		background-color: #fef2f2;
		border-color: #fca5a5;
	}

	:global(html[data-theme='dark']) .typed-correct {
		background-color: rgba(20, 83, 45, 0.2);
		border-color: rgba(74, 222, 128, 0.4);
	}

	:global(html[data-theme='dark']) .typed-incorrect {
		background-color: rgba(127, 29, 29, 0.2);
		border-color: rgba(248, 113, 113, 0.4);
	}

	.typed-label,
	.correct-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .typed-label,
	:global(html[data-theme='dark']) .correct-label {
		color: #94a3b8;
	}

	.typed-text {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--text-color, #0f172a);
	}

	.correct-answer-display {
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		padding: 0.75rem 1.25rem;
		border-radius: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	:global(html[data-theme='dark']) .correct-answer-display {
		background-color: #2a303c;
		border-color: #3a4150;
	}

	.meaning-text {
		font-size: 1.5rem;
		font-weight: 800;
		margin: 0;
		color: var(--text-color, #1e293b);
	}

	.meta-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.meta-tag {
		background-color: #f8fafc;
		color: #475569;
		padding: 0.5rem 1rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
		border: 1px solid #e2e8f0;
	}

	:global(html[data-theme='dark']) .meta-tag {
		background-color: #2a303c;
		color: #cbd5e1;
		border-color: #3a4150;
	}

	.meta-tag strong {
		color: var(--text-color, #0f172a);
		margin-left: 0.25rem;
	}

	.action-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.btn-override {
		background-color: #f8fafc;
		color: #475569;
		border: 2px solid #94a3b8;
		box-shadow: 0 2px 0 #cbd5e1;
		font-size: 0.9375rem;
		font-weight: 700;
		padding: 0.75rem 1.25rem;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.btn-override:hover {
		background-color: #f1f5f9;
		border-color: #64748b;
		transform: translateY(-1px);
		box-shadow: 0 3px 0 #cbd5e1;
	}

	.override-icon {
		font-size: 1.1rem;
		line-height: 1;
	}

	:global(html[data-theme='dark']) .btn-override {
		background-color: #2a303c;
		color: #cbd5e1;
		border-color: #64748b;
		box-shadow: 0 2px 0 #3a4150;
	}

	:global(html[data-theme='dark']) .btn-override:hover {
		background-color: #3a4150;
		border-color: #94a3b8;
		box-shadow: 0 3px 0 #3a4150;
	}

	.btn-continue {
		flex: 1;
		padding-top: 1rem;
		padding-bottom: 1rem;
		font-size: 1.125rem;
	}

	.continue-hint {
		font-size: 0.65rem;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.35);
		border-radius: 0.3rem;
		padding: 0.1rem 0.4rem;
		margin-left: 0.5rem;
		letter-spacing: 0.04em;
		opacity: 0.85;
	}
</style>
