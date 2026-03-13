<script lang="ts">
	import type { PageData } from './$types';
	import { fly, fade } from 'svelte/transition';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
	import VoiceDictation from '$lib/components/VoiceDictation.svelte';
	import { requiresSpecialKeyboard } from '$lib/utils/keyboard';
	import { page } from '$app/stores';
	export let data: PageData;

	let currentReviewIndex = 0;
	let isSubmitting = false;
	let isGrading = false;
	let typedAnswer = '';
	let reviewInputRef: HTMLInputElement;

	let gradeResult: { correct: boolean; score: number } | null = null;
	let userOverride: boolean | null = null;

	$: activeLangName = $page.data.user?.activeLanguage?.name || 'en';
	$: dueReviews = data.dueReviews || [];
	$: currentReview = dueReviews[currentReviewIndex];
	$: isFinished = dueReviews.length > 0 ? currentReviewIndex >= dueReviews.length : true;
	$: showingAnswer = gradeResult !== null;

	$: if (currentReview && !showingAnswer && reviewInputRef) {
		setTimeout(() => reviewInputRef?.focus(), 0);
	}

	$: effectiveCorrect = userOverride !== null ? userOverride : gradeResult?.correct ?? false;
	$: effectiveScore = userOverride !== null ? (userOverride ? 1.0 : 0.0) : (gradeResult?.score ?? 0);

	async function showAnswer() {
		if (isGrading) return;

		if (!typedAnswer.trim()) {
			gradeResult = { correct: false, score: 0 };
			return;
		}

		isGrading = true;
		try {
			const res = await fetch('/api/review/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userAnswer: typedAnswer,
					lemma: currentReview.vocabulary.lemma,
					correctMeaning: (currentReview.vocabulary as any).meanings?.[0]?.value || ''
				})
			});

			if (res.ok) {
				gradeResult = await res.json();
			} else {
				gradeResult = { correct: false, score: 0 };
			}
		} catch {
			gradeResult = { correct: false, score: 0 };
		} finally {
			isGrading = false;
		}
	}

	async function submitAndNext() {
		if (isSubmitting || !currentReview) return;
		isSubmitting = true;

		try {
			const res = await fetch('/api/review/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					vocabularyId: currentReview.vocabulary.id,
					score: effectiveScore
				})
			});

			if (res.ok) {
				currentReviewIndex++;
				gradeResult = null;
				userOverride = null;
				typedAnswer = '';
			}
		} catch (e) {
			console.error('Failed to submit review', e);
		} finally {
			isSubmitting = false;
		}
	}

	function toggleOverride() {
		userOverride = userOverride !== null ? !userOverride : !gradeResult?.correct;
	}

	async function skipWord() {
		if (isSubmitting || !currentReview) return;
		isSubmitting = true;

		try {
			const res = await fetch('/api/review/submit', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					vocabularyId: currentReview.vocabulary.id,
					score: 0
				})
			});

			if (res.ok) {
				currentReviewIndex++;
				gradeResult = null;
				userOverride = null;
				typedAnswer = '';
			}
		} catch (e) {
			console.error('Failed to skip review', e);
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
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
									<!-- Grade Result Banner -->
									<div class="grade-banner" class:grade-correct={effectiveCorrect} class:grade-incorrect={!effectiveCorrect}>
										<div class="grade-icon">
											{#if effectiveCorrect}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
													<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
												</svg>
											{/if}
										</div>
										<span class="grade-label">{effectiveCorrect ? 'Correct' : 'Incorrect'}</span>
									</div>

									<!-- Answer Info -->
									<div class="answer-info">
										{#if typedAnswer}
											<div class="typed-answer-display" class:typed-correct={effectiveCorrect} class:typed-incorrect={!effectiveCorrect}>
												<span class="typed-label">Your answer</span>
												<span class="typed-text">{typedAnswer}</span>
											</div>
										{/if}
										<div class="correct-answer-display">
											<span class="correct-label">Correct answer</span>
											<p class="meaning-text">
												{(currentReview.vocabulary as any).meanings?.[0]?.value || 'No meaning provided'}
											</p>
										</div>
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

									<!-- Actions -->
									<div class="action-row">
										<button class="btn-duo btn-override" on:click={toggleOverride} aria-label="{effectiveCorrect ? "Mark as incorrect" : "Mark as correct"}">
											<span class="override-icon">&#x21A9;</span>
											{effectiveCorrect ? 'Mark as incorrect' : 'Mark as correct'}
										</button>
										<button
											class="btn-duo btn-primary btn-continue"
											on:click={submitAndNext}
											disabled={isSubmitting}
										>
											{isSubmitting ? 'Saving...' : 'Continue'}
										</button>
									</div>
								</div>
							{:else}
								<div class="typing-section">
									<div class="typing-label-row">
										<label class="typing-label" for="review-input">
											Type your answer (optional)
										</label>
										<VoiceDictation
											lang="en-US"
											bind:value={typedAnswer}
											inputElement={reviewInputRef}
										/>
									</div>
									{#if requiresSpecialKeyboard(currentReview.vocabulary.lemma, activeLangName)}
										<SpecialCharKeyboard
											bind:value={typedAnswer}
											inputElement={reviewInputRef}
											language={activeLangName}
										/>
									{/if}
									<input
										id="review-input"
										bind:this={reviewInputRef}
										bind:value={typedAnswer}
										type="text"
										class="review-input"
										placeholder="Type translation here..."
										autofocus
										on:keydown={(e) => e.key === 'Enter' && showAnswer()}
									/>
								</div>
								<button
									class="btn-duo btn-primary show-answer-btn"
									on:click={showAnswer}
									disabled={isGrading}
								>
									{#if isGrading}
										<span class="grading-spinner"></span>
										Grading...
									{:else}
										Show Answer
									{/if}
								</button>
								<button
									class="btn-skip"
									on:click={skipWord}
									disabled={isSubmitting}
								>
									Skip this word
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
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.grading-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

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

	/* Grade banner */
	.grade-banner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border-radius: 1rem;
		font-weight: 800;
		font-size: 1.125rem;
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

	/* Answer info */
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
		background-color: #1e293b;
		border-color: #334155;
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
		background-color: #1e293b;
		color: #cbd5e1;
		border-color: #334155;
	}

	.meta-tag strong {
		color: var(--text-color, #0f172a);
		margin-left: 0.25rem;
	}

	/* Action row */
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
		background-color: #1e293b;
		color: #cbd5e1;
		border-color: #64748b;
		box-shadow: 0 2px 0 #334155;
	}

	:global(html[data-theme='dark']) .btn-override:hover {
		background-color: #334155;
		border-color: #94a3b8;
		box-shadow: 0 3px 0 #334155;
	}

	.btn-continue {
		flex: 1;
		padding-top: 1rem;
		padding-bottom: 1rem;
		font-size: 1.125rem;
	}

	.typing-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.typing-label-row .typing-label {
		margin-bottom: 0;
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

	.btn-skip {
		display: block;
		margin: 0.75rem auto 0;
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.375rem 0.75rem;
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: color 0.15s;
	}

	.btn-skip:hover {
		color: #64748b;
	}

	.btn-skip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(html[data-theme='dark']) .btn-skip {
		color: #64748b;
	}

	:global(html[data-theme='dark']) .btn-skip:hover {
		color: #94a3b8;
	}
</style>
