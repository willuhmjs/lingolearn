<script lang="ts">
	import type { PageData } from './$types';
	import { fly, fade } from 'svelte/transition';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
	import { requiresSpecialKeyboard } from '$lib/utils/keyboard';
	import { page } from '$app/stores';
	export let data: PageData;

	let currentReviewIndex = 0;
	let showingAnswer = false;
	let isSubmitting = false;
	let typedAnswer = '';
	let reviewInputRef: HTMLInputElement;

	$: dueReviews = data.dueReviews || [];
	$: currentReview = dueReviews[currentReviewIndex];
	$: isFinished = dueReviews.length > 0 ? currentReviewIndex >= dueReviews.length : true;

	function showAnswer() {
		showingAnswer = true;
	}

	async function submitGrade(score: number) {
		if (isSubmitting || !currentReview) return;
		isSubmitting = true;

		try {
			const res = await fetch('/api/review/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					vocabularyId: currentReview.vocabulary.id,
					score
				})
			});

			if (res.ok) {
				currentReviewIndex++;
				showingAnswer = false;
				typedAnswer = '';
			}
		} catch (e) {
			console.error('Failed to submit review', e);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>Vocabulary Review - LingoLearn</title>
</svelte:head>

<div class="page-container">
	<div class="content-wrapper">
		<header class="page-header review-header" in:fly={{ y: 20, duration: 400 }}>
			<h1>Vocabulary Review</h1>
			{#if !isFinished && dueReviews.length > 0}
				<span class="review-counter">
					{currentReviewIndex + 1} / {dueReviews.length}
				</span>
			{/if}
		</header>

		{#if isFinished}
			<div class="card-duo finished-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<div class="success-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h2>All caught up!</h2>
				<p>You have no more reviews due right now. Great job keeping your streak alive!</p>
				<a href="/dashboard" class="btn-duo btn-primary back-btn">Back to Dashboard</a>
			</div>
		{:else if currentReview}
			{#key currentReview.vocabulary.id}
				<div class="card-duo review-card" in:fly={{ x: 50, duration: 300 }} out:fade={{ duration: 150 }}>
					<!-- Progress Bar -->
					<div class="progress-track">
						<div
							class="progress-fill"
							style="width: {(currentReviewIndex / dueReviews.length) * 100}%"
						></div>
					</div>

					<div class="review-content">
						<!-- Question Area -->
						<div class="question-area">
							<h2 class="lemma-text">
								{currentReview.vocabulary.lemma}
							</h2>

							{#if currentReview.vocabulary.partOfSpeech}
								<span class="pos-badge">
									{currentReview.vocabulary.partOfSpeech}
								</span>
							{/if}
						</div>

						<div class="answer-section">
							{#if showingAnswer}
								<div class="answer-reveal">
									<!-- Divider -->
									<div class="divider">
										<span>Answer</span>
									</div>

									<!-- Answer Info -->
									<div class="answer-info">
										{#if typedAnswer}
											<div class="typed-answer-display">
												<span class="typed-label">You typed:</span>
												<span class="typed-text">{typedAnswer}</span>
											</div>
										{/if}
										<p class="meaning-text">
											{(currentReview.vocabulary as any).meanings?.[0]?.value || 'No meaning provided'}
										</p>
										<div class="meta-tags">
											{#if currentReview.vocabulary.gender}
												<span class="meta-tag">
													Gender: <strong>{currentReview.vocabulary.gender}</strong>
												</span>
											{/if}
											{#if currentReview.vocabulary.plural}
												<span class="meta-tag">
													Plural: <strong>{currentReview.vocabulary.plural}</strong>
												</span>
											{/if}
										</div>
									</div>

									<!-- Grading Buttons -->
									<div class="grading-buttons">
										<button
											class="btn-duo btn-danger"
											on:click={() => submitGrade(0)}
											disabled={isSubmitting}
										>
											Again
										</button>
										<button
											class="btn-duo btn-hard"
											on:click={() => submitGrade(0.4)}
											disabled={isSubmitting}
										>
											Hard
										</button>
										<button
											class="btn-duo btn-primary"
											on:click={() => submitGrade(0.8)}
											disabled={isSubmitting}
										>
											Good
										</button>
										<button
											class="btn-duo btn-easy"
											on:click={() => submitGrade(1.0)}
											disabled={isSubmitting}
										>
											Easy
										</button>
									</div>
								</div>
							{:else}
								<div class="typing-section">
									<label class="typing-label">
										Type your answer (optional)
									</label>
									{#if requiresSpecialKeyboard(currentReview.vocabulary.lemma, $page.data.user?.activeLanguage?.name || 'en')}
										<SpecialCharKeyboard
											bind:value={typedAnswer}
											inputElement={reviewInputRef}
											language={$page.data.user?.activeLanguage?.name || 'en'}
										/>
									{/if}
									<input
										bind:this={reviewInputRef}
										bind:value={typedAnswer}
										type="text"
										class="review-input"
										placeholder="Type translation here..."
										on:keydown={(e) => e.key === 'Enter' && showAnswer()}
									/>
								</div>
								<button class="btn-duo btn-primary show-answer-btn" on:click={showAnswer}>
									Show Answer
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/key}
		{/if}
	</div>
</div>

<style>
	.page-container {
		display: flex;
		justify-content: center;
		padding: 2rem 1rem;
		min-height: calc(100vh - 4rem);
	}

	.content-wrapper {
		width: 100%;
		max-width: 600px;
	}

	.review-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 2rem;
	}

	.review-header h1 {
		font-size: 2rem;
		margin: 0;
		color: var(--text-color, #0f172a);
	}

	.review-counter {
		background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
		color: #1e40af;
		padding: 0.5rem 1rem;
		border-radius: 1rem;
		font-size: 0.875rem;
		font-weight: 800;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}

	:global(html[data-theme='dark']) .review-counter {
		background: linear-gradient(135deg, rgba(30, 58, 138, 0.3) 0%, rgba(30, 58, 138, 0.5) 100%);
		color: #bfdbfe;
		box-shadow: none;
	}

	.finished-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background-color: var(--card-bg, #ffffff);
		border-color: var(--card-border, #e2e8f0);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
	}

	:global(html[data-theme='dark']) .finished-card {
		box-shadow: 0 4px 0 var(--card-border, #374151);
	}

	.success-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 7rem;
		height: 7rem;
		background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
		color: #16a34a;
		border-radius: 50%;
		margin-bottom: 2rem;
		box-shadow: 0 4px 0 #16a34a33;
		animation: bounce-subtle 2s infinite ease-in-out;
	}

	.success-icon svg {
		width: 3.5rem;
		height: 3.5rem;
	}

	:global(html[data-theme='dark']) .success-icon {
		background: linear-gradient(135deg, rgba(20, 83, 45, 0.4) 0%, rgba(21, 128, 61, 0.4) 100%);
		color: #4ade80;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
	}

	.finished-card h2 {
		font-size: 2rem;
		margin: 0 0 1rem 0;
		color: var(--text-color, #0f172a);
	}

	.finished-card p {
		font-size: 1.125rem;
		color: #64748b;
		margin: 0 0 2.5rem 0;
		max-width: 400px;
		line-height: 1.5;
	}

	.back-btn {
		width: 100%;
		max-width: 200px;
	}

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
		background-color: #1e293b;
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

	.lemma-text {
		font-size: 3rem;
		font-weight: 800;
		margin: 0 0 1rem 0;
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
		background-color: #1e293b;
		border-color: #334155;
		color: #cbd5e1;
	}

	.answer-section {
		margin-top: 2rem;
	}

	.show-answer-btn {
		width: 100%;
		padding-top: 1rem;
		padding-bottom: 1rem;
		font-size: 1.125rem;
	}

	.answer-reveal {
		animation: fadeIn 0.3s ease-out;
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

	.divider {
		position: relative;
		text-align: center;
		margin-bottom: 2rem;
	}

	.divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		border-top: 1px solid var(--card-border, #e2e8f0);
	}

	.divider span {
		position: relative;
		background-color: var(--card-bg, #ffffff);
		padding: 0 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #94a3b8;
	}

	.answer-info {
		text-align: center;
		margin-bottom: 2.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.typed-answer-display {
		background-color: #f1f5f9;
		padding: 0.75rem 1.25rem;
		border-radius: 1rem;
		border: 1px solid #e2e8f0;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	:global(html[data-theme='dark']) .typed-answer-display {
		background-color: #1e293b;
		border-color: #334155;
	}

	.typed-label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		color: #64748b;
		letter-spacing: 0.05em;
	}

	.typed-text {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-color, #0f172a);
	}

	.meaning-text {
		font-size: 1.75rem;
		font-weight: 800;
		margin: 0.5rem 0;
		color: var(--text-color, #1e293b);
	}

	.typing-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.typing-label {
		font-size: 0.875rem;
		font-weight: 700;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .typing-label {
		color: #94a3b8;
	}

	.review-input {
		width: 100%;
		padding: 1rem;
		font-size: 1.125rem;
		font-weight: 600;
		border: 2px solid #e2e8f0;
		border-radius: 1rem;
		background-color: white;
		color: #0f172a;
		transition: all 0.2s;
		box-sizing: border-box;
	}

	.review-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
	}

	:global(html[data-theme='dark']) .review-input {
		background-color: #1e293b;
		border-color: #334155;
		color: white;
	}

	:global(html[data-theme='dark']) .review-input:focus {
		border-color: #3b82f6;
	}

	.meta-tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.5rem;
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
		background-color: #1e293b;
		color: #cbd5e1;
		border-color: #334155;
	}

	.meta-tag strong {
		color: var(--text-color, #0f172a);
		margin-left: 0.25rem;
	}

	.grading-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.grading-buttons {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.grading-buttons button {
		padding-top: 1rem;
		padding-bottom: 1rem;
		width: 100%;
	}

	.btn-hard {
		background-color: #f97316;
		color: white;
		box-shadow: 0 4px 0 #c2410c;
	}

	.btn-hard:hover {
		background-color: #fb923c;
		transform: scale(1.02);
	}

	.btn-hard:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #c2410c;
	}

	.btn-easy {
		background-color: #06b6d4;
		color: white;
		box-shadow: 0 4px 0 #0891b2;
	}

	.btn-easy:hover {
		background-color: #22d3ee;
		transform: scale(1.02);
	}

	.btn-easy:active {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #0891b2;
	}
</style>
