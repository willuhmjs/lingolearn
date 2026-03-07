<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	let currentReviewIndex = 0;
	let showingAnswer = false;
	let isSubmitting = false;

	$: dueReviews = data.dueReviews || [];
	$: currentReview = dueReviews[currentReviewIndex];
	$: isFinished = currentReviewIndex >= dueReviews.length;

	function showAnswer() {
		showingAnswer = true;
	}

	async function submitGrade(score: number) {
		if (isSubmitting || !currentReview) return;
		isSubmitting = true;
		
		try {
			// Reuse the submit-answer endpoint or create a simpler one for SRS?
			// The instructions say: "Update the existing src/routes/api/submit-answer/+server.ts or create a new endpoint to calculate and update SRS metrics in the database after each flashcard attempt using a basic algorithm (like SM-2)."
			// It might be easiest to create a dedicated review endpoint rather than going through the complex grader.
			// Let's create `src/routes/api/review/submit/+server.ts` to just record the review and return.
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
			}
		} catch (e) {
			console.error('Failed to submit review', e);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="container mx-auto max-w-2xl px-4 py-12">
	<h1 class="mb-8 text-3xl font-bold">Vocabulary Review</h1>

	{#if isFinished}
		<div class="rounded-xl bg-base-200 p-8 text-center shadow-lg">
			<h2 class="mb-4 text-2xl font-bold text-success">All caught up!</h2>
			<p class="text-base-content/70">You have no more reviews due right now. Great job!</p>
			<a href="/dashboard" class="btn btn-primary mt-6">Back to Dashboard</a>
		</div>
	{:else if currentReview}
		<div class="flex flex-col items-center">
			<div class="mb-4 text-sm text-base-content/60">
				Review {currentReviewIndex + 1} of {dueReviews.length}
			</div>

			<div class="card w-full bg-base-100 shadow-xl">
				<div class="card-body items-center text-center">
					<h2 class="card-title text-4xl mb-4">{currentReview.vocabulary.lemma}</h2>
					
					{#if currentReview.vocabulary.partOfSpeech}
						<div class="badge badge-secondary mb-4">{currentReview.vocabulary.partOfSpeech}</div>
					{/if}

					{#if showingAnswer}
						<div class="divider">Answer</div>
						<p class="text-xl mb-2">{currentReview.vocabulary.meaning || 'No meaning provided'}</p>
						{#if currentReview.vocabulary.gender}
							<p class="text-sm text-base-content/70">Gender: {currentReview.vocabulary.gender}</p>
						{/if}
						{#if currentReview.vocabulary.plural}
							<p class="text-sm text-base-content/70">Plural: {currentReview.vocabulary.plural}</p>
						{/if}

						<div class="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
							<button class="btn btn-error" on:click={() => submitGrade(0)} disabled={isSubmitting}>Again</button>
							<button class="btn btn-warning" on:click={() => submitGrade(0.4)} disabled={isSubmitting}>Hard</button>
							<button class="btn btn-success" on:click={() => submitGrade(0.8)} disabled={isSubmitting}>Good</button>
							<button class="btn btn-info" on:click={() => submitGrade(1.0)} disabled={isSubmitting}>Easy</button>
						</div>
					{:else}
						<div class="mt-8 w-full">
							<button class="btn btn-primary w-full" on:click={showAnswer}>Show Answer</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
