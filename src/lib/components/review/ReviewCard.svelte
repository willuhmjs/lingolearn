<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import SrsPanel from './SrsPanel.svelte';
	import AnswerReveal from './AnswerReveal.svelte';
	import ReviewInput from './ReviewInput.svelte';

	let {
		review,
		currentIndex,
		totalCount,
		typedAnswer = $bindable(),
		showingAnswer,
		effectiveCorrect,
		isGrading,
		isSubmitting,
		activeLangName,
		reviewCopied,
		oncopyword,
		onshowanswer,
		onskip,
		ontoggleoverride,
		onsubmitnext
	}: {
		review: any;
		currentIndex: number;
		totalCount: number;
		typedAnswer: string;
		showingAnswer: boolean;
		effectiveCorrect: boolean;
		isGrading: boolean;
		isSubmitting: boolean;
		activeLangName: string;
		reviewCopied: boolean;
		oncopyword: () => void;
		onshowanswer: () => void;
		onskip: () => void;
		ontoggleoverride: () => void;
		onsubmitnext: () => void;
	} = $props();

	let showSrsPanel = $state(false);

	let progressPct = $derived((currentIndex / totalCount) * 100);
	let correctMeaning = $derived((review.vocabulary as any).meanings?.[0]?.value || '');
</script>

{#key review.vocabulary.id}
	<div class="card-duo review-card" in:fly={{ x: 50, duration: 300 }} out:fade={{ duration: 150 }}>
		<!-- Progress Bar -->
		<div class="progress-track">
			<div class="progress-fill" style="width: {progressPct}%"></div>
		</div>

		<div class="review-content">
			<!-- Question Area -->
			<div class="question-area">
				<div class="lemma-row">
					<h2 class="lemma-text">{review.vocabulary.lemma}</h2>
					<button
						class="copy-btn-lemma"
						onclick={oncopyword}
						title="Copy word"
						aria-label="Copy {review.vocabulary.lemma}"
						>{#if reviewCopied}✓{:else}<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								style="width:1rem;height:1rem"
								><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path
									d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
								></path></svg
							>{/if}</button
					>
				</div>

				<div class="question-area-meta">
					{#if review.vocabulary.partOfSpeech}
						<span class="pos-badge">
							{review.vocabulary.partOfSpeech}
						</span>
					{/if}
					<button
						class="srs-info-btn"
						onclick={() => (showSrsPanel = !showSrsPanel)}
						title="SRS info"
						aria-label="Show SRS data">ⓘ</button
					>
				</div>

				<SrsPanel show={showSrsPanel} {review} />
			</div>

			<div class="answer-section">
				{#if showingAnswer}
					<AnswerReveal
						{effectiveCorrect}
						{typedAnswer}
						{correctMeaning}
						gender={review.vocabulary.gender}
						plural={review.vocabulary.plural}
						{isSubmitting}
						{ontoggleoverride}
						{onsubmitnext}
					/>
				{:else}
					<ReviewInput
						bind:typedAnswer
						lemma={review.vocabulary.lemma}
						{activeLangName}
						{isGrading}
						{isSubmitting}
						{onshowanswer}
						{onskip}
					/>
				{/if}
			</div>
		</div>
	</div>
{/key}

<style>
	.review-card {
		position: relative;
		overflow: hidden;
		padding: 0;
		background-color: var(--card-bg, #ffffff);
		border-color: var(--card-border, #e2e8f0);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	:global(html[data-theme='dark']) .review-card {
		box-shadow: 0 4px 0 var(--card-border, #374151);
	}

	.progress-track {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 8px;
		background-color: #f1f5f9;
		z-index: 10;
	}

	:global(html[data-theme='dark']) .progress-track {
		background-color: #2a303c;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #60a5fa);
		transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
		border-radius: 0 4px 4px 0;
	}

	.review-content {
		display: flex;
		flex-direction: column;
		min-height: 450px;
		padding: 3rem 1.5rem 2rem;
	}

	@media (min-width: 640px) {
		.review-content {
			padding: 3.5rem 2.5rem 2.5rem;
		}
	}

	.question-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 1rem 0;
	}

	.lemma-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.copy-btn-lemma {
		background: none;
		border: none;
		cursor: pointer;
		color: #94a3b8;
		padding: 0.2rem;
		border-radius: 0.3rem;
		line-height: 1;
		font-size: 1rem;
		font-weight: 700;
		transition: color 0.15s;
		flex-shrink: 0;
		align-self: flex-start;
		margin-top: 0.75rem;
	}

	.copy-btn-lemma:hover {
		color: #3b82f6;
	}

	.lemma-text {
		font-size: 3rem;
		font-weight: 800;
		margin: 0;
		color: var(--text-color, #0f172a);
		letter-spacing: -0.02em;
	}

	@media (min-width: 640px) {
		.lemma-text {
			font-size: 3.75rem;
		}
	}

	.pos-badge {
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		color: #475569;
		padding: 0.375rem 1rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 700;
	}

	:global(html[data-theme='dark']) .pos-badge {
		background-color: #2a303c;
		border-color: #3a4150;
		color: #cbd5e1;
	}

	.question-area-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		flex-wrap: wrap;
	}

	.srs-info-btn {
		background: none;
		border: none;
		font-size: 1.1rem;
		color: #94a3b8;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		transition: color 0.15s;
	}

	.srs-info-btn:hover {
		color: #3b82f6;
	}

	.answer-section {
		margin-top: 2rem;
	}
</style>
