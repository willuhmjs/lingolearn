<script lang="ts">
	import type { PageData } from './$types';
	import { fly, fade, scale } from 'svelte/transition';
	import { elasticOut } from 'svelte/easing';
	import SpecialCharKeyboard from '$lib/components/SpecialCharKeyboard.svelte';
	import VoiceDictation from '$lib/components/VoiceDictation.svelte';
	import Confetti from '$lib/components/Confetti.svelte';
	import { requiresSpecialKeyboard } from '$lib/utils/keyboard';
	import { haptics } from '$lib/utils/haptic';
	import { page } from '$app/stores';
	export let data: PageData;

	let sessionStarted = false;
	let currentReviewIndex = 0;
	let isSubmitting = false;
	let isGrading = false;
	let typedAnswer = '';
	let reviewInputRef: HTMLInputElement;

	let gradeResult: { correct: boolean; score: number } | null = null;
	let userOverride: boolean | null = null;
	let showKeyboardHelp = false;
	let triggerConfetti = false;

	// Session summary tracking (#7)
	type ReviewResult = { lemma: string; correct: boolean; answer: string; correctMeaning: string };
	let sessionResults: ReviewResult[] = [];

	// Undo history (#8)
	type UndoEntry = { index: number; result: ReviewResult };
	let undoStack: UndoEntry[] = [];
	$: canUndo = undoStack.length > 0 && !showingAnswer;

	$: activeLangName = $page.data.user?.activeLanguage?.name || 'en';
	$: dueReviews = data.dueReviews || [];
	$: currentReview = dueReviews[currentReviewIndex];
	$: isFinished = sessionStarted && (dueReviews.length === 0 || currentReviewIndex >= dueReviews.length);
	$: hasNoReviews = !sessionStarted && dueReviews.length === 0;
	$: showingAnswer = gradeResult !== null;

	$: if (currentReview && !showingAnswer && reviewInputRef) {
		setTimeout(() => reviewInputRef?.focus(), 0);
	}

	$: effectiveCorrect = userOverride !== null ? userOverride : gradeResult?.correct ?? false;
	$: effectiveScore = userOverride !== null ? (userOverride ? 1.0 : 0.0) : (gradeResult?.score ?? 0);

	// Summary stats (#7)
	$: correctCount = sessionResults.filter((r) => r.correct).length;
	$: incorrectCount = sessionResults.filter((r) => !r.correct).length;
	$: accuracyPct = sessionResults.length > 0 ? Math.round((correctCount / sessionResults.length) * 100) : 0;
	$: missedWords = sessionResults.filter((r) => !r.correct);

	// Trigger confetti on perfect session
	$: if (isFinished && accuracyPct === 100 && sessionResults.length > 0 && !triggerConfetti) {
		triggerConfetti = true;
		setTimeout(() => {
			triggerConfetti = false;
		}, 100);
	}

	// Enhanced keyboard shortcuts (#10)
	function handleGlobalKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
		const isInputField = tag === 'input' || tag === 'textarea';

		// Shift+R: Report an error
		if (e.shiftKey && e.key.toLowerCase() === 'r' && sessionStarted && !isFinished) {
			e.preventDefault();
			reportError();
			return;
		}

		// Don't interfere with input fields for other shortcuts
		if (isInputField && e.key !== 'Enter') return;

		if (!sessionStarted) return;

		// After showing answer: Space/Enter to continue
		if (showingAnswer) {
			if ((e.key === ' ' || e.key === 'Enter') && !isSubmitting) {
				e.preventDefault();
				submitAndNext();
			}
			return;
		}

		// Before showing answer: Enter to submit
		if (e.key === 'Enter' && !isGrading) {
			e.preventDefault();
			showAnswer();
			return;
		}

		// TODO: Space to play audio (when audio is implemented)
		// if (e.key === ' ' && currentReview?.audio) {
		// 	e.preventDefault();
		// 	playAudio();
		// }
	}

	function reportError() {
		// TODO: Implement error reporting UI
		alert('Error reporting feature coming soon! This will allow you to flag incorrect translations or mistakes.');
	}

	async function showAnswer() {
		if (isGrading) return;

		haptics.medium(); // Haptic feedback on submission

		if (!typedAnswer.trim()) {
			gradeResult = { correct: false, score: 0 };
			haptics.error(); // Haptic for empty answer
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
				const result = await res.json();
				gradeResult = result;
				// Haptic feedback based on result
				if (result.correct) {
					haptics.success();
				} else {
					haptics.error();
				}
			} else {
				gradeResult = { correct: false, score: 0 };
				haptics.error();
			}
		} catch {
			gradeResult = { correct: false, score: 0 };
			haptics.error();
		} finally {
			isGrading = false;
		}
	}

	async function submitAndNext() {
		if (isSubmitting || !currentReview) return;
		isSubmitting = true;

		haptics.medium(); // Haptic on continue

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
				const result: ReviewResult = {
					lemma: currentReview.vocabulary.lemma,
					correct: effectiveCorrect,
					answer: typedAnswer,
					correctMeaning: (currentReview.vocabulary as any).meanings?.[0]?.value || ''
				};
				undoStack = [...undoStack, { index: currentReviewIndex, result }];
				sessionResults = [...sessionResults, result];

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
		haptics.light(); // Haptic on toggle
		userOverride = userOverride !== null ? !userOverride : !gradeResult?.correct;
	}

	async function skipWord() {
		if (isSubmitting || !currentReview) return;
		isSubmitting = true;

		haptics.light(); // Light haptic for skip

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
				const result: ReviewResult = {
					lemma: currentReview.vocabulary.lemma,
					correct: false,
					answer: '',
					correctMeaning: (currentReview.vocabulary as any).meanings?.[0]?.value || ''
				};
				undoStack = [...undoStack, { index: currentReviewIndex, result }];
				sessionResults = [...sessionResults, result];

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

	// Undo last submitted card (#8)
	function undoLast() {
		if (undoStack.length === 0 || showingAnswer) return;
		haptics.warning(); // Haptic for undo action
		const last = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);
		sessionResults = sessionResults.slice(0, -1);
		currentReviewIndex = last.index;
		typedAnswer = '';
		gradeResult = null;
		userOverride = null;
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<svelte:head>
	<title>Vocabulary Review - LingoLearn</title>
</svelte:head>

<Confetti trigger={triggerConfetti} />

<div class="page-container">
	<div class="content-wrapper">
		<header class="page-header review-header" in:fly={{ y: 20, duration: 400 }}>
			<h1>Vocabulary Review</h1>
			<div class="review-header-right">
				{#if sessionStarted && !isFinished && dueReviews.length > 0}
					<span class="review-counter">
						{currentReviewIndex + 1} / {dueReviews.length}
					</span>
				{/if}
				{#if canUndo}
					<button class="btn-undo" onclick={undoLast} title="Undo last card">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 14L4 9l5-5" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 9h11a5 5 0 010 10h-1" />
						</svg>
						Undo
					</button>
				{/if}
				<button class="btn-kbd-help" onclick={() => showKeyboardHelp = !showKeyboardHelp} title="Keyboard shortcuts">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<rect x="2" y="4" width="20" height="16" rx="2" />
						<path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
					</svg>
				</button>
			</div>
		</header>

		<!-- Keyboard Shortcuts Help Modal -->
		{#if showKeyboardHelp}
			<div class="kbd-modal-overlay" role="button" tabindex="0" onclick={() => showKeyboardHelp = false} onkeydown={(e) => e.key === 'Escape' && (showKeyboardHelp = false)}>
				<div class="kbd-modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
					<div class="kbd-modal-header">
						<h3>Keyboard Shortcuts</h3>
						<button class="kbd-modal-close" onclick={() => showKeyboardHelp = false}>×</button>
					</div>
					<div class="kbd-modal-body">
						<div class="kbd-shortcut">
							<span class="kbd-key">Enter</span>
							<span class="kbd-desc">Show answer / Continue</span>
						</div>
						<div class="kbd-shortcut">
							<span class="kbd-key">Space</span>
							<span class="kbd-desc">Continue after grading</span>
						</div>
						<div class="kbd-shortcut">
							<span class="kbd-key">Shift</span> + <span class="kbd-key">R</span>
							<span class="kbd-desc">Report an error</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		{#if hasNoReviews}
			<div class="card-duo finished-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<div class="success-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h2>All caught up!</h2>
				<p>No reviews due right now. Great job keeping your streak alive!</p>
				<p class="empty-cta-desc">Want to keep practicing? Head over to Play to learn new words.</p>
				<div class="empty-cta-row">
					<a href="/play" class="btn-duo btn-primary">Go to Play</a>
					<a href="/dashboard" class="btn-duo btn-secondary">Dashboard</a>
				</div>
			</div>
		{:else if !sessionStarted}
			<div class="card-duo session-start-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<div class="session-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
						<polyline points="2 17 12 22 22 17"></polyline>
						<polyline points="2 12 12 17 22 12"></polyline>
					</svg>
				</div>
				<h2>Ready to review?</h2>
				<p>You have <strong>{dueReviews.length}</strong> {dueReviews.length === 1 ? 'card' : 'cards'} due for review.</p>
				<button class="btn-duo btn-primary start-session-btn" onclick={() => sessionStarted = true}>
					Start Reviewing
				</button>
				<a href="/dashboard" class="btn-skip">Not now</a>
			</div>
		{:else if isFinished}
			<!-- Session Summary (#7) -->
			<div class="card-duo summary-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
				<div
					class="summary-icon"
					class:summary-perfect={accuracyPct === 100}
					class:summary-good={accuracyPct >= 70 && accuracyPct < 100}
					class:summary-ok={accuracyPct < 70}
					in:scale={{ duration: 600, delay: 200, easing: elasticOut }}
				>
					{#if accuracyPct === 100}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
							<polyline points="2 17 12 22 22 17"></polyline>
							<polyline points="2 12 12 17 22 12"></polyline>
						</svg>
					{/if}
				</div>
				<h2>{accuracyPct === 100 ? 'Perfect session!' : accuracyPct >= 70 ? 'Great work!' : 'Session complete'}</h2>
				<p>You reviewed <strong>{sessionResults.length}</strong> {sessionResults.length === 1 ? 'card' : 'cards'}.</p>

				<div class="summary-stats">
					<div class="summary-stat correct">
						<span class="stat-num">{correctCount}</span>
						<span class="stat-lbl">Correct</span>
					</div>
					<div class="summary-stat accuracy">
						<span class="stat-num">{accuracyPct}%</span>
						<span class="stat-lbl">Accuracy</span>
					</div>
					<div class="summary-stat incorrect">
						<span class="stat-num">{incorrectCount}</span>
						<span class="stat-lbl">Missed</span>
					</div>
				</div>

				{#if missedWords.length > 0}
					<div class="missed-words">
						<h3 class="missed-title">Words to revisit</h3>
						<ul class="missed-list">
							{#each missedWords as item}
								<li class="missed-item">
									<span class="missed-lemma">{item.lemma}</span>
									<span class="missed-arrow">→</span>
									<span class="missed-meaning">{item.correctMeaning}</span>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

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
										<button class="btn-duo btn-override" onclick={toggleOverride} aria-label="{effectiveCorrect ? "Mark as incorrect" : "Mark as correct"}">
											<span class="override-icon">&#x21A9;</span>
											{effectiveCorrect ? 'Mark as incorrect' : 'Mark as correct'}
										</button>
										<button
											class="btn-duo btn-primary btn-continue"
											onclick={submitAndNext}
											disabled={isSubmitting}
										>
											{isSubmitting ? 'Saving...' : 'Continue'}
											{#if !isSubmitting}<span class="continue-hint">Space</span>{/if}
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
										onkeydown={(e) => e.key === 'Enter' && showAnswer()}
									/>
								</div>
								<button
									class="btn-duo btn-primary show-answer-btn"
									onclick={showAnswer}
									disabled={isGrading}
								>
									{#if isGrading}
										<span class="grading-spinner"></span>
										Grading...
									{:else}
										Show Answer
										<span class="kbd-hint">Enter</span>
									{/if}
								</button>
								<button
									class="btn-skip"
									onclick={skipWord}
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

	.review-header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
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

	/* Undo button (#8) */
	.btn-undo {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: none;
		border: 2px solid #e2e8f0;
		color: #64748b;
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.4rem 0.75rem;
		border-radius: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-undo svg {
		width: 1rem;
		height: 1rem;
	}

	.btn-undo:hover {
		border-color: #94a3b8;
		color: #334155;
		background: #f8fafc;
	}

	:global(html[data-theme='dark']) .btn-undo {
		border-color: #3a4150;
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .btn-undo:hover {
		border-color: #64748b;
		color: #cbd5e1;
		background: #2a303c;
	}

	/* Keyboard hints */
	.continue-hint,
	.kbd-hint {
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

	/* Keyboard help button */
	.btn-kbd-help {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 2px solid #e2e8f0;
		color: #64748b;
		padding: 0.4rem;
		border-radius: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
		width: 2.5rem;
		height: 2.5rem;
	}

	.btn-kbd-help svg {
		width: 1.2rem;
		height: 1.2rem;
	}

	.btn-kbd-help:hover {
		border-color: #94a3b8;
		color: #334155;
		background: #f8fafc;
	}

	:global(html[data-theme='dark']) .btn-kbd-help {
		border-color: #3a4150;
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .btn-kbd-help:hover {
		border-color: #64748b;
		color: #cbd5e1;
		background: #2a303c;
	}

	/* Keyboard modal */
	.kbd-modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.kbd-modal {
		background: var(--card-bg, #ffffff);
		border-radius: 1rem;
		padding: 1.5rem;
		max-width: 400px;
		width: 100%;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.kbd-modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.kbd-modal-header h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		color: var(--text-color, #0f172a);
	}

	.kbd-modal-close {
		background: none;
		border: none;
		font-size: 2rem;
		color: #94a3b8;
		cursor: pointer;
		padding: 0;
		line-height: 1;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.5rem;
		transition: all 0.15s;
	}

	.kbd-modal-close:hover {
		background: #f1f5f9;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .kbd-modal-close:hover {
		background: #2a303c;
		color: #cbd5e1;
	}

	.kbd-modal-body {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.kbd-shortcut {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.kbd-key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 3rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 700;
		background: #f8fafc;
		border: 2px solid #e2e8f0;
		border-radius: 0.375rem;
		color: #475569;
		box-shadow: 0 2px 0 #e2e8f0;
	}

	:global(html[data-theme='dark']) .kbd-key {
		background: #1e293b;
		border-color: #334155;
		color: #cbd5e1;
		box-shadow: 0 2px 0 #334155;
	}

	.kbd-desc {
		flex: 1;
		font-size: 0.875rem;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .kbd-desc {
		color: #94a3b8;
	}

	.session-start-card {
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

	:global(html[data-theme='dark']) .session-start-card {
		box-shadow: 0 4px 0 var(--card-border, #374151);
	}

	.session-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 7rem;
		height: 7rem;
		background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
		color: #1d4ed8;
		border-radius: 50%;
		margin-bottom: 2rem;
		box-shadow: 0 4px 0 rgba(29, 78, 216, 0.2);
	}

	.session-icon svg {
		width: 3rem;
		height: 3rem;
	}

	:global(html[data-theme='dark']) .session-icon {
		background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 64, 175, 0.4) 100%);
		color: #93c5fd;
		box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
	}

	.session-start-card h2 {
		font-size: 2rem;
		margin: 0 0 0.75rem 0;
		color: var(--text-color, #0f172a);
	}

	.session-start-card p {
		font-size: 1.125rem;
		color: #64748b;
		margin: 0 0 2rem 0;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .session-start-card p {
		color: #94a3b8;
	}

	.session-start-card p strong {
		color: #1d4ed8;
		font-size: 1.5rem;
	}

	:global(html[data-theme='dark']) .session-start-card p strong {
		color: #93c5fd;
	}

	.start-session-btn {
		width: 100%;
		max-width: 220px;
		padding-top: 1rem;
		padding-bottom: 1rem;
		font-size: 1.125rem;
		margin-bottom: 0.5rem;
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
		animation: bounce-subtle 2s infinite ease-in-out, pulse-glow 2s infinite;
	}

	@keyframes pulse-glow {
		0%, 100% {
			box-shadow: 0 4px 0 #16a34a33, 0 0 0 0 rgba(16, 185, 129, 0.4);
		}
		50% {
			box-shadow: 0 4px 0 #16a34a33, 0 0 0 12px rgba(16, 185, 129, 0);
		}
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

	:global(html[data-theme='dark']) .finished-card p {
		color: #94a3b8;
	}

	.back-btn {
		width: 100%;
		max-width: 200px;
	}

	.empty-cta-desc {
		color: #64748b;
		font-size: 0.9rem;
		margin-top: 0.25rem !important;
	}

	.empty-cta-row {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.btn-secondary {
		background: transparent;
		border: 2px solid var(--card-border, #e2e8f0);
		color: var(--text-color, #0f172a);
	}

	.btn-secondary:hover {
		background: var(--card-border, #e2e8f0);
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
		background-color: #2a303c;
		border-color: #3a4150;
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
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.show-answer-btn:hover:not(:disabled) {
		transform: translateY(-2px) scale(1.02);
	}

	.show-answer-btn:active:not(:disabled) {
		transform: translateY(0) scale(0.98);
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
		background-color: #2a303c;
		border-color: #3a4150;
		color: #e2e8f0;
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
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .btn-skip:hover {
		color: #cbd5e1;
	}

	/* Session Summary card (#7) */
	.summary-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 3rem 2rem;
		text-align: center;
		background-color: var(--card-bg, #ffffff);
		border-color: var(--card-border, #e2e8f0);
		box-shadow: 0 4px 0 var(--card-border, #e2e8f0);
		gap: 1.25rem;
	}

	:global(html[data-theme='dark']) .summary-card {
		box-shadow: 0 4px 0 var(--card-border, #374151);
	}

	.summary-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 6rem;
		height: 6rem;
		border-radius: 50%;
		box-shadow: 0 4px 0 rgba(0,0,0,0.1);
	}

	.summary-icon svg { width: 2.75rem; height: 2.75rem; }

	.summary-perfect {
		background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
		color: #16a34a;
		box-shadow: 0 4px 0 #16a34a33;
		position: relative;
		overflow: hidden;
	}

	.summary-perfect::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: linear-gradient(
			45deg,
			transparent 30%,
			rgba(255, 255, 255, 0.3) 50%,
			transparent 70%
		);
		animation: shimmer 3s infinite;
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%) translateY(-100%) rotate(45deg);
		}
		100% {
			transform: translateX(100%) translateY(100%) rotate(45deg);
		}
	}
	.summary-good {
		background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
		color: #2563eb;
		box-shadow: 0 4px 0 #2563eb22;
	}
	.summary-ok {
		background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
		color: #d97706;
		box-shadow: 0 4px 0 #d9770622;
	}

	:global(html[data-theme='dark']) .summary-perfect {
		background: linear-gradient(135deg, rgba(20, 83, 45, 0.4) 0%, rgba(21, 128, 61, 0.4) 100%);
		color: #4ade80;
	}
	:global(html[data-theme='dark']) .summary-good {
		background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 64, 175, 0.4) 100%);
		color: #93c5fd;
	}
	:global(html[data-theme='dark']) .summary-ok {
		background: linear-gradient(135deg, rgba(120, 53, 15, 0.4) 0%, rgba(146, 64, 14, 0.4) 100%);
		color: #fbbf24;
	}

	.summary-card h2 {
		font-size: 1.75rem;
		font-weight: 800;
		margin: 0;
		color: var(--text-color, #0f172a);
	}

	.summary-card p {
		font-size: 1rem;
		color: #64748b;
		margin: 0;
	}

	:global(html[data-theme='dark']) .summary-card p {
		color: #94a3b8;
	}

	.summary-card p strong {
		color: #2563eb;
		font-size: 1.2em;
	}

	:global(html[data-theme='dark']) .summary-card p strong {
		color: #93c5fd;
	}

	.summary-stats {
		display: flex;
		gap: 1.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.summary-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		min-width: 5rem;
	}

	.stat-num {
		font-size: 2.25rem;
		font-weight: 900;
		line-height: 1;
	}

	.stat-lbl {
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
	}

	:global(html[data-theme='dark']) .stat-lbl {
		color: #94a3b8;
	}

	.summary-stat.correct .stat-num { color: #16a34a; }
	.summary-stat.incorrect .stat-num { color: #dc2626; }
	.summary-stat.accuracy .stat-num { color: #2563eb; }

	:global(html[data-theme='dark']) .summary-stat.correct .stat-num { color: #4ade80; }
	:global(html[data-theme='dark']) .summary-stat.incorrect .stat-num { color: #f87171; }
	:global(html[data-theme='dark']) .summary-stat.accuracy .stat-num { color: #93c5fd; }

	.missed-words {
		width: 100%;
		text-align: left;
		border: 2px solid var(--card-border, #e2e8f0);
		border-radius: 1rem;
		overflow: hidden;
	}

	.missed-title {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #64748b;
		margin: 0;
		padding: 0.75rem 1rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		background: #f8fafc;
	}

	:global(html[data-theme='dark']) .missed-title {
		background: #2a303c;
		border-color: #3a4150;
		color: #94a3b8;
	}

	.missed-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.missed-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--card-border, #f1f5f9);
		font-size: 0.95rem;
	}

	.missed-item:last-child { border-bottom: none; }

	.missed-lemma {
		font-weight: 800;
		color: var(--text-color, #1e293b);
	}

	.missed-arrow {
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.missed-meaning {
		color: #64748b;
		font-weight: 600;
	}

	:global(html[data-theme='dark']) .missed-item {
		border-color: #1e293b;
	}

	:global(html[data-theme='dark']) .missed-meaning {
		color: #94a3b8;
	}
</style>
