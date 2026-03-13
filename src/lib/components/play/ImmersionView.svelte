<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import toast from 'svelte-french-toast';

	export let language: { name: string; flag?: string } | null = null;
	export let cefrLevel: string = 'A1';
	export let assignmentId: string | null = null;
	export let assignmentProgress: { score: number; targetScore: number; passed: boolean } | null = null;

	type MediaType =
		| 'news_article'
		| 'advertisement'
		| 'restaurant_menu'
		| 'social_post'
		| 'recipe'
		| 'review'
		| 'letter';

	type Question = {
		id: string;
		type: 'multiple_choice' | 'free_response';
		question: string;
		options?: string[];
		correctIndex?: number;
		explanation?: string;
		sampleAnswer?: string;
		points: number;
	};

	type ImmersionSession = {
		mediaType: MediaType;
		templateData: Record<string, any>;
		questions: Question[];
	};

	const MEDIA_LABELS: Record<MediaType, { label: string; icon: string }> = {
		news_article: { label: 'News Article', icon: '📰' },
		advertisement: { label: 'Advertisement', icon: '📢' },
		restaurant_menu: { label: 'Restaurant Menu', icon: '🍽️' },
		social_post: { label: 'Social Post', icon: '💬' },
		recipe: { label: 'Recipe', icon: '👨‍🍳' },
		review: { label: 'Review', icon: '⭐' },
		letter: { label: 'Letter', icon: '✉️' }
	};

	const MEDIA_TYPES: Array<MediaType | 'random'> = [
		'random',
		'news_article',
		'advertisement',
		'restaurant_menu',
		'social_post',
		'recipe',
		'review',
		'letter'
	];

	let selectedMediaType: MediaType | 'random' = 'random';
	let session: ImmersionSession | null = null;
	let loading = false;
	let error = '';

	// Answer tracking
	type AnswerState = {
		// MCQ
		selectedOption?: number;
		mcqSubmitted?: boolean;
		mcqCorrect?: boolean;
		// Free response
		frText?: string;
		frSubmitting?: boolean;
		frScore?: number;
		frFeedback?: string;
		frSubmitted?: boolean;
	};
	let answers: Record<string, AnswerState> = {};

	let totalXpEarned = 0;
	let sessionComplete = false;
	let mcqXpAwarded = false; // tracks if MCQ XP was awarded via API

	async function generate() {
		loading = true;
		error = '';
		session = null;
		answers = {};
		totalXpEarned = 0;
		sessionComplete = false;

		try {
			const res = await fetch('/api/immersion/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mediaType: selectedMediaType })
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || 'Failed to generate content');
			}
			session = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			toast.error(error);
		} finally {
			loading = false;
		}
	}

	function handleMcqSelect(questionId: string, optionIndex: number, question: Question) {
		if (answers[questionId]?.mcqSubmitted) return;

		const correct = optionIndex === question.correctIndex;
		answers[questionId] = {
			...answers[questionId],
			selectedOption: optionIndex,
			mcqSubmitted: true,
			mcqCorrect: correct
		};
		// Trigger reactivity
		answers = answers;

		// For assignments, immediately track correct MCQ answers
		if (assignmentId && correct) {
			fetch('/api/immersion/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ directXp: 0, assignmentId, correctCount: 1 })
			})
				.then((res) => res.json())
				.then((data) => {
					if (data.assignmentProgress && assignmentProgress) {
						assignmentProgress = data.assignmentProgress;
					}
				})
				.catch(() => {});
		}

		checkSessionComplete();
	}

	async function submitFreeResponse(question: Question) {
		const state = answers[question.id] || {};
		if (!state.frText?.trim() || state.frSubmitted) return;

		answers[question.id] = { ...state, frSubmitting: true };
		answers = answers;

		try {
			const res = await fetch('/api/immersion/grade', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					question: question.question,
					userAnswer: state.frText,
					sampleAnswer: question.sampleAnswer,
					awardXp: question.points,
					assignmentId
				})
			});
			const result = await res.json();
			if (result.assignmentProgress && assignmentProgress) {
				assignmentProgress = result.assignmentProgress;
			}
			const xpEarned = Math.round(question.points * (result.score || 0));
			totalXpEarned += xpEarned;

			answers[question.id] = {
				...answers[question.id],
				frSubmitting: false,
				frScore: result.score,
				frFeedback: result.feedback,
				frSubmitted: true
			};
			answers = answers;
		} catch (e) {
			answers[question.id] = { ...answers[question.id], frSubmitting: false };
			answers = answers;
			toast.error('Could not grade your answer. Please try again.');
		}

		checkSessionComplete();
	}

	function checkSessionComplete() {
		if (!session) return;
		const allAnswered = session.questions.every((q) => {
			const a = answers[q.id];
			if (q.type === 'multiple_choice') return a?.mcqSubmitted;
			if (q.type === 'free_response') return a?.frSubmitted;
			return false;
		});

		if (allAnswered && !sessionComplete) {
			sessionComplete = true;
			// Tally MCQ XP (awarded client-side since it doesn't need LLM)
			let mcqXp = 0;
			let mcqCorrectCount = 0;
			session.questions.forEach((q) => {
				if (q.type === 'multiple_choice' && answers[q.id]?.mcqCorrect) {
					mcqXp += q.points;
					mcqCorrectCount++;
				}
			});
			if (mcqXp > 0 && !assignmentId) {
				totalXpEarned += mcqXp;
				// Award MCQ XP directly (no LLM grading needed, skip for assignments)
				fetch('/api/immersion/grade', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ directXp: mcqXp })
				}).catch(() => {});
			}
		}
	}

	function starRating(n: number) {
		return '★'.repeat(n) + '☆'.repeat(5 - n);
	}

	function getScoreClass(score: number) {
		if (score >= 0.8) return 'score-great';
		if (score >= 0.5) return 'score-ok';
		return 'score-poor';
	}

	$: allAnswered =
		session?.questions.every((q) => {
			const a = answers[q.id];
			if (q.type === 'multiple_choice') return a?.mcqSubmitted;
			if (q.type === 'free_response') return a?.frSubmitted;
			return false;
		}) ?? false;

	$: pendingFreeResponses = session?.questions.filter(
		(q) => q.type === 'free_response' && !answers[q.id]?.frSubmitted
	) ?? [];
</script>

<div class="immersion-root">
	<!-- Controls -->
	<div class="controls-card" in:fly={{ y: 16, duration: 300 }}>
		<div class="controls-header">
			<div>
				<h2 class="controls-title">Immerse</h2>
				<p class="controls-desc">
					Read authentic {language?.name || 'target language'} content, then answer comprehension questions.
				</p>
			</div>
			{#if language?.flag}
				<span class="lang-flag">{language.flag}</span>
			{/if}
		</div>

		<div class="type-selector">
			<span class="selector-label">Content type:</span>
			<div class="type-pills">
				{#each MEDIA_TYPES as type}
					<button
						class="type-pill"
						class:active={selectedMediaType === type}
						on:click={() => (selectedMediaType = type)}
					>
						{type === 'random'
							? '🎲 Random'
							: MEDIA_LABELS[type].icon + ' ' + MEDIA_LABELS[type].label}
					</button>
				{/each}
			</div>
		</div>

		<button class="generate-btn" on:click={generate} disabled={loading}>
			{#if loading}
				<span class="spinner" />
				Generating...
			{:else if session}
				Generate New
			{:else}
				Generate Content
			{/if}
		</button>
	</div>

	{#if loading}
		<div class="loading-card" in:fade={{ duration: 200 }}>
			<div class="loading-inner">
				<div class="loading-spinner" />
				<p>Creating your {selectedMediaType === 'random' ? 'content' : selectedMediaType.replace(/_/g, ' ')}...</p>
			</div>
		</div>
	{/if}

	{#if session && !loading}
		<div class="session-wrapper" in:fly={{ y: 20, duration: 400 }}>
			<!-- Media template -->
			<div class="media-card">
				<div class="media-type-badge">
					{MEDIA_LABELS[session.mediaType].icon}
					{MEDIA_LABELS[session.mediaType].label}
				</div>

				<!-- NEWS ARTICLE -->
				{#if session.mediaType === 'news_article'}
					<div class="template news-template">
						<div class="news-source-bar">
							<span class="news-source">{session.templateData.source}</span>
							<span class="news-date">{session.templateData.date}</span>
						</div>
						<h1 class="news-headline">{session.templateData.headline}</h1>
						<p class="news-byline">{session.templateData.byline}</p>
						<hr class="news-rule" />
						<p class="news-lead">{session.templateData.lead}</p>
						<p class="news-body">{session.templateData.body}</p>
					</div>

				<!-- ADVERTISEMENT -->
				{:else if session.mediaType === 'advertisement'}
					<div class="template ad-template">
						<div class="ad-brand">{session.templateData.brand}</div>
						<h2 class="ad-product">{session.templateData.product}</h2>
						<p class="ad-slogan">"{session.templateData.slogan}"</p>
						{#if session.templateData.features?.length}
							<ul class="ad-features">
								{#each session.templateData.features as feat}
									<li>{feat}</li>
								{/each}
							</ul>
						{/if}
						{#if session.templateData.price}
							<p class="ad-price">{session.templateData.price}</p>
						{/if}
						<button class="ad-cta" disabled>{session.templateData.callToAction}</button>
						{#if session.templateData.disclaimer}
							<p class="ad-disclaimer">{session.templateData.disclaimer}</p>
						{/if}
					</div>

				<!-- RESTAURANT MENU -->
				{:else if session.mediaType === 'restaurant_menu'}
					<div class="template menu-template">
						<div class="menu-header">
							<h1 class="menu-name">{session.templateData.restaurantName}</h1>
							<p class="menu-tagline">{session.templateData.tagline}</p>
						</div>
						{#each (session.templateData.sections || []) as section}
							<div class="menu-section">
								<h3 class="menu-section-title">{section.name}</h3>
								{#each (section.items || []) as item}
									<div class="menu-item">
										<div class="menu-item-info">
											<span class="menu-item-name">{item.name}</span>
											<span class="menu-item-desc">{item.description}</span>
										</div>
										<span class="menu-item-price">{item.price}</span>
									</div>
								{/each}
							</div>
						{/each}
					</div>

				<!-- SOCIAL POST -->
				{:else if session.mediaType === 'social_post'}
					<div class="template social-template">
						<div class="social-header">
							<div class="social-avatar">{session.templateData.username?.[0] ?? '?'}</div>
							<div>
								<div class="social-username">{session.templateData.username}</div>
								<div class="social-handle">{session.templateData.handle}</div>
							</div>
							<span class="social-timestamp">{session.templateData.timestamp}</span>
						</div>
						<p class="social-content">{session.templateData.content}</p>
						{#if session.templateData.hashtags?.length}
							<p class="social-hashtags">
								{session.templateData.hashtags.join(' ')}
							</p>
						{/if}
						<div class="social-stats">
							<span>❤️ {session.templateData.likes}</span>
							<span>💬 {session.templateData.comments}</span>
						</div>
					</div>

				<!-- RECIPE -->
				{:else if session.mediaType === 'recipe'}
					<div class="template recipe-template">
						<h1 class="recipe-title">{session.templateData.title}</h1>
						<div class="recipe-meta">
							<span>🍽️ {session.templateData.servings} Portionen</span>
							<span>⏱ Zubereitung: {session.templateData.prepTime}</span>
							<span>🔥 Kochzeit: {session.templateData.cookTime}</span>
							<span>📊 {session.templateData.difficulty}</span>
						</div>
						<div class="recipe-cols">
							<div class="recipe-ingredients">
								<h3>Zutaten</h3>
								<ul>
									{#each (session.templateData.ingredients || []) as ing}
										<li>{ing}</li>
									{/each}
								</ul>
							</div>
							<div class="recipe-steps">
								<h3>Zubereitung</h3>
								<ol>
									{#each (session.templateData.steps || []) as step}
										<li>{step}</li>
									{/each}
								</ol>
							</div>
						</div>
						{#if session.templateData.tips}
							<div class="recipe-tip">
								<strong>Tipp:</strong> {session.templateData.tips}
							</div>
						{/if}
					</div>

				<!-- REVIEW -->
				{:else if session.mediaType === 'review'}
					<div class="template review-template">
						<div class="review-header">
							<div>
								<h2 class="review-subject">{session.templateData.subject}</h2>
								<p class="review-stars">{starRating(session.templateData.rating ?? 0)}</p>
							</div>
							<div class="review-meta">
								<span class="review-author">{session.templateData.author}</span>
								<span class="review-date">{session.templateData.date}</span>
							</div>
						</div>
						<p class="review-body">{session.templateData.body}</p>
						<div class="review-verdict">
							<strong>Fazit:</strong> {session.templateData.verdict}
						</div>
					</div>

				<!-- LETTER -->
				{:else if session.mediaType === 'letter'}
					<div class="template letter-template">
						<div class="letter-location-date">
							{session.templateData.location}, {session.templateData.date}
						</div>
						<p class="letter-salutation">{session.templateData.salutation}</p>
						<p class="letter-body">{session.templateData.body}</p>
						<p class="letter-closing">{session.templateData.closing}</p>
						<p class="letter-signature">{session.templateData.signature}</p>
					</div>
				{/if}
			</div>

			<!-- Questions -->
			<div class="questions-section">
				<h3 class="questions-title">Comprehension Questions</h3>
				<p class="questions-subtitle">Answer in English based on what you read.</p>

				{#each session.questions as question, i}
					{@const state = answers[question.id] || {}}
					<div class="question-card" in:fly={{ y: 16, duration: 300, delay: i * 80 }}>
						<div class="question-header">
							<span class="question-num">Q{i + 1}</span>
							<span class="question-badge {question.type === 'multiple_choice' ? 'badge-mcq' : 'badge-fr'}">
								{question.type === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}
							</span>
							<span class="question-points">{question.points} pts</span>
						</div>
						<p class="question-text">{question.question}</p>

						{#if question.type === 'multiple_choice'}
							<div class="mcq-options">
								{#each (question.options || []) as option, idx}
									<button
										class="mcq-option"
										class:selected={state.selectedOption === idx && !state.mcqSubmitted}
										class:correct={state.mcqSubmitted && idx === question.correctIndex}
										class:incorrect={state.mcqSubmitted &&
											state.selectedOption === idx &&
											idx !== question.correctIndex}
										class:dimmed={state.mcqSubmitted && idx !== question.correctIndex && state.selectedOption !== idx}
										disabled={state.mcqSubmitted}
										on:click={() => handleMcqSelect(question.id, idx, question)}
									>
										<span class="option-letter">{String.fromCharCode(65 + idx)}</span>
										{option}
									</button>
								{/each}
							</div>
							{#if state.mcqSubmitted}
								<div class="mcq-result {state.mcqCorrect ? 'result-correct' : 'result-incorrect'}">
									{state.mcqCorrect ? '✓ Correct!' : '✗ Incorrect'}
									{#if state.mcqCorrect}
										<span class="xp-badge">+{question.points} XP</span>
									{/if}
								</div>
								{#if question.explanation}
									<p class="mcq-explanation">{question.explanation}</p>
								{/if}
							{/if}

						{:else}
							<!-- Free response -->
							<textarea
								class="fr-input"
								placeholder="Type your answer here..."
								bind:value={state.frText}
								disabled={state.frSubmitted || state.frSubmitting}
								on:input={() => { answers[question.id] = state; answers = answers; }}
							/>
							{#if !state.frSubmitted}
								<button
									class="fr-submit-btn"
									disabled={!state.frText?.trim() || state.frSubmitting}
									on:click={() => submitFreeResponse(question)}
								>
									{state.frSubmitting ? 'Grading...' : 'Submit Answer'}
								</button>
							{/if}
							{#if state.frSubmitted}
								<div class="fr-result">
									<div class="fr-score-row {getScoreClass(state.frScore ?? 0)}">
										<span class="fr-score-label">Score:</span>
										<span class="fr-score-pct">{Math.round((state.frScore ?? 0) * 100)}%</span>
										{#if (state.frScore ?? 0) > 0}
											<span class="xp-badge">+{Math.round(question.points * (state.frScore ?? 0))} XP</span>
										{/if}
									</div>
									{#if state.frFeedback}
										<p class="fr-feedback">{state.frFeedback}</p>
									{/if}
									{#if question.sampleAnswer}
										<details class="sample-answer-details">
											<summary>See sample answer</summary>
											<p>{question.sampleAnswer}</p>
										</details>
									{/if}
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>

			<!-- Session complete summary -->
			{#if allAnswered}
				<div class="summary-card" in:fly={{ y: 16, duration: 400 }}>
					<div class="summary-icon">🎉</div>
					<h3>Session Complete!</h3>
					<p class="summary-xp">You earned <strong>{totalXpEarned} XP</strong> this session.</p>
					<button class="generate-btn" on:click={generate}>
						Read Another
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.immersion-root {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 760px;
		margin: 0 auto;
	}

	/* Controls card */
	.controls-card {
		background: var(--card-bg, #fff);
		border: 1.5px solid var(--card-border, #e2e8f0);
		border-radius: 1.25rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	:global(html[data-theme='dark']) .controls-card {
		background: #1e293b;
		border-color: #334155;
	}

	.controls-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.controls-title {
		font-size: 1.3rem;
		font-weight: 800;
		color: var(--text-color, #1e293b);
		margin: 0 0 0.2rem;
	}

	:global(html[data-theme='dark']) .controls-title {
		color: #f1f5f9;
	}

	.controls-desc {
		font-size: 0.9rem;
		color: #64748b;
		margin: 0;
	}

	.lang-flag {
		font-size: 2rem;
		flex-shrink: 0;
	}

	.selector-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #64748b;
		margin-bottom: 0.5rem;
		display: block;
	}

	.type-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.type-pill {
		padding: 0.35rem 0.85rem;
		border-radius: 2rem;
		border: 1.5px solid var(--card-border, #e2e8f0);
		background: transparent;
		font-size: 0.82rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
		transition: all 0.15s;
	}

	.type-pill:hover {
		border-color: #1cb0f6;
		color: #1cb0f6;
	}

	.type-pill.active {
		background: #1cb0f6;
		border-color: #1cb0f6;
		color: #fff;
	}

	:global(html[data-theme='dark']) .type-pill {
		border-color: #334155;
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .type-pill.active {
		background: #1cb0f6;
		color: #fff;
	}

	.generate-btn {
		padding: 0.8rem 1.5rem;
		background: #7c3aed;
		color: #fff;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
		transition: background 0.15s, transform 0.1s;
		box-shadow: 0 4px 0 #5b21b6;
	}

	.generate-btn:hover:not(:disabled) {
		background: #6d28d9;
		transform: translateY(-1px);
	}

	.generate-btn:disabled {
		opacity: 0.6;
		cursor: default;
		transform: none;
		box-shadow: 0 2px 0 #5b21b6;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255,255,255,0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		display: inline-block;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	/* Loading */
	.loading-card {
		background: var(--card-bg, #fff);
		border: 1.5px solid var(--card-border, #e2e8f0);
		border-radius: 1.25rem;
		padding: 3rem;
	}

	:global(html[data-theme='dark']) .loading-card {
		background: #1e293b;
		border-color: #334155;
	}

	.loading-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		color: #64748b;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e2e8f0;
		border-top-color: #7c3aed;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	/* Session wrapper */
	.session-wrapper {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Media card */
	.media-card {
		background: var(--card-bg, #fff);
		border: 1.5px solid var(--card-border, #e2e8f0);
		border-radius: 1.25rem;
		overflow: hidden;
	}

	:global(html[data-theme='dark']) .media-card {
		background: #1e293b;
		border-color: #334155;
	}

	.media-type-badge {
		background: #f8fafc;
		border-bottom: 1px solid var(--card-border, #e2e8f0);
		padding: 0.6rem 1.25rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: #64748b;
		letter-spacing: 0.05em;
		text-transform: uppercase;
	}

	:global(html[data-theme='dark']) .media-type-badge {
		background: #0f172a;
		border-color: #334155;
		color: #94a3b8;
	}

	.template {
		padding: 1.5rem;
	}

	/* News article template */
	.news-source-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.78rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 700;
		margin-bottom: 0.75rem;
	}

	.news-headline {
		font-size: 1.6rem;
		font-weight: 900;
		line-height: 1.2;
		color: #0f172a;
		margin: 0 0 0.5rem;
		font-family: Georgia, 'Times New Roman', serif;
	}

	:global(html[data-theme='dark']) .news-headline {
		color: #f1f5f9;
	}

	.news-byline {
		font-size: 0.85rem;
		color: #64748b;
		font-style: italic;
		margin: 0 0 0.75rem;
	}

	.news-rule {
		border: none;
		border-top: 2px solid #0f172a;
		margin: 0.75rem 0;
	}

	:global(html[data-theme='dark']) .news-rule {
		border-color: #f1f5f9;
	}

	.news-lead {
		font-size: 1.05rem;
		font-weight: 600;
		line-height: 1.65;
		color: #1e293b;
		margin: 0 0 1rem;
		font-family: Georgia, serif;
	}

	:global(html[data-theme='dark']) .news-lead {
		color: #e2e8f0;
	}

	.news-body {
		font-size: 0.97rem;
		line-height: 1.75;
		color: #334155;
		margin: 0;
		font-family: Georgia, serif;
		white-space: pre-line;
	}

	:global(html[data-theme='dark']) .news-body {
		color: #cbd5e1;
	}

	/* Advertisement template */
	.ad-template {
		background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
		color: #fff;
		text-align: center;
		border-radius: 0 0 1.25rem 1.25rem;
		padding: 2rem 1.5rem;
	}

	.ad-brand {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.15em;
		color: rgba(255,255,255,0.6);
		margin-bottom: 0.5rem;
	}

	.ad-product {
		font-size: 2rem;
		font-weight: 900;
		margin: 0 0 0.75rem;
	}

	.ad-slogan {
		font-size: 1.1rem;
		font-style: italic;
		color: rgba(255,255,255,0.85);
		margin: 0 0 1.25rem;
	}

	.ad-features {
		list-style: none;
		padding: 0;
		margin: 0 0 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		text-align: left;
		max-width: 360px;
		margin-left: auto;
		margin-right: auto;
	}

	.ad-features li::before {
		content: '✓ ';
		color: #4ade80;
		font-weight: 700;
	}

	.ad-price {
		font-size: 1.4rem;
		font-weight: 900;
		color: #fbbf24;
		margin: 0 0 1rem;
	}

	.ad-cta {
		background: #fbbf24;
		color: #0f172a;
		border: none;
		border-radius: 0.5rem;
		padding: 0.75rem 2rem;
		font-size: 1rem;
		font-weight: 800;
		cursor: default;
		display: inline-block;
		margin-bottom: 1rem;
	}

	.ad-disclaimer {
		font-size: 0.7rem;
		color: rgba(255,255,255,0.4);
		margin: 0;
	}

	/* Restaurant menu template */
	.menu-template {
		font-family: Georgia, serif;
	}

	.menu-header {
		text-align: center;
		border-bottom: 2px solid #e2e8f0;
		padding-bottom: 1rem;
		margin-bottom: 1rem;
	}

	:global(html[data-theme='dark']) .menu-header {
		border-color: #334155;
	}

	.menu-name {
		font-size: 1.8rem;
		font-weight: 900;
		margin: 0 0 0.25rem;
		color: #0f172a;
	}

	:global(html[data-theme='dark']) .menu-name {
		color: #f1f5f9;
	}

	.menu-tagline {
		font-style: italic;
		color: #64748b;
		margin: 0;
	}

	.menu-section {
		margin-bottom: 1.25rem;
	}

	.menu-section-title {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-weight: 700;
		color: #64748b;
		margin: 0 0 0.75rem;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 0.25rem;
	}

	:global(html[data-theme='dark']) .menu-section-title {
		border-color: #334155;
		color: #94a3b8;
	}

	.menu-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.menu-item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.menu-item-name {
		font-weight: 700;
		color: #1e293b;
		font-size: 0.97rem;
	}

	:global(html[data-theme='dark']) .menu-item-name {
		color: #e2e8f0;
	}

	.menu-item-desc {
		font-size: 0.85rem;
		color: #64748b;
		font-style: italic;
	}

	.menu-item-price {
		font-weight: 700;
		font-size: 0.95rem;
		color: #1e293b;
		white-space: nowrap;
		flex-shrink: 0;
	}

	:global(html[data-theme='dark']) .menu-item-price {
		color: #e2e8f0;
	}

	/* Social post template */
	.social-template {
		max-width: 480px;
	}

	.social-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.social-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: linear-gradient(135deg, #1cb0f6, #7c3aed);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.1rem;
		flex-shrink: 0;
	}

	.social-username {
		font-weight: 700;
		font-size: 0.95rem;
		color: #1e293b;
	}

	:global(html[data-theme='dark']) .social-username {
		color: #f1f5f9;
	}

	.social-handle {
		font-size: 0.82rem;
		color: #64748b;
	}

	.social-timestamp {
		margin-left: auto;
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.social-content {
		font-size: 0.97rem;
		line-height: 1.6;
		color: #1e293b;
		margin: 0 0 0.75rem;
		white-space: pre-line;
	}

	:global(html[data-theme='dark']) .social-content {
		color: #e2e8f0;
	}

	.social-hashtags {
		font-size: 0.9rem;
		color: #1cb0f6;
		margin: 0 0 0.75rem;
	}

	.social-stats {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		color: #64748b;
		border-top: 1px solid #e2e8f0;
		padding-top: 0.75rem;
	}

	:global(html[data-theme='dark']) .social-stats {
		border-color: #334155;
	}

	/* Recipe template */
	.recipe-title {
		font-size: 1.6rem;
		font-weight: 900;
		margin: 0 0 0.75rem;
		color: #0f172a;
	}

	:global(html[data-theme='dark']) .recipe-title {
		color: #f1f5f9;
	}

	.recipe-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}

	.recipe-meta span {
		background: #f1f5f9;
		border-radius: 0.5rem;
		padding: 0.25rem 0.6rem;
		font-size: 0.82rem;
		font-weight: 600;
		color: #475569;
	}

	:global(html[data-theme='dark']) .recipe-meta span {
		background: #0f172a;
		color: #94a3b8;
	}

	.recipe-cols {
		display: grid;
		grid-template-columns: 1fr 1.5fr;
		gap: 1.5rem;
	}

	@media (max-width: 520px) {
		.recipe-cols {
			grid-template-columns: 1fr;
		}
	}

	.recipe-ingredients h3,
	.recipe-steps h3 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #64748b;
		margin: 0 0 0.5rem;
	}

	.recipe-ingredients ul {
		padding-left: 1.2rem;
		margin: 0;
	}

	.recipe-ingredients li {
		font-size: 0.9rem;
		line-height: 1.8;
		color: #334155;
	}

	:global(html[data-theme='dark']) .recipe-ingredients li {
		color: #cbd5e1;
	}

	.recipe-steps ol {
		padding-left: 1.4rem;
		margin: 0;
	}

	.recipe-steps li {
		font-size: 0.9rem;
		line-height: 1.75;
		color: #334155;
		margin-bottom: 0.4rem;
	}

	:global(html[data-theme='dark']) .recipe-steps li {
		color: #cbd5e1;
	}

	.recipe-tip {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		background: #fefce8;
		border-left: 3px solid #fbbf24;
		border-radius: 0 0.5rem 0.5rem 0;
		font-size: 0.88rem;
		color: #713f12;
	}

	:global(html[data-theme='dark']) .recipe-tip {
		background: #1c1400;
		color: #fbbf24;
	}

	/* Review template */
	.review-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.review-subject {
		font-size: 1.3rem;
		font-weight: 800;
		margin: 0 0 0.25rem;
		color: #0f172a;
	}

	:global(html[data-theme='dark']) .review-subject {
		color: #f1f5f9;
	}

	.review-stars {
		font-size: 1.2rem;
		color: #fbbf24;
		margin: 0;
	}

	.review-meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.2rem;
		font-size: 0.82rem;
		color: #64748b;
	}

	.review-author {
		font-weight: 600;
		color: #475569;
	}

	:global(html[data-theme='dark']) .review-author {
		color: #94a3b8;
	}

	.review-body {
		font-size: 0.95rem;
		line-height: 1.75;
		color: #334155;
		white-space: pre-line;
		margin: 0 0 1rem;
	}

	:global(html[data-theme='dark']) .review-body {
		color: #cbd5e1;
	}

	.review-verdict {
		background: #f8fafc;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		font-size: 0.9rem;
		color: #475569;
		border-left: 3px solid #1cb0f6;
	}

	:global(html[data-theme='dark']) .review-verdict {
		background: #0f172a;
		color: #94a3b8;
	}

	/* Letter template */
	.letter-template {
		font-family: Georgia, serif;
		max-width: 520px;
	}

	.letter-location-date {
		text-align: right;
		color: #64748b;
		font-size: 0.9rem;
		margin-bottom: 1.25rem;
	}

	.letter-salutation {
		font-weight: 700;
		margin: 0 0 0.75rem;
		color: #1e293b;
	}

	:global(html[data-theme='dark']) .letter-salutation {
		color: #e2e8f0;
	}

	.letter-body {
		font-size: 0.97rem;
		line-height: 1.85;
		color: #334155;
		white-space: pre-line;
		margin: 0 0 1.25rem;
	}

	:global(html[data-theme='dark']) .letter-body {
		color: #cbd5e1;
	}

	.letter-closing {
		margin: 0 0 0.25rem;
		color: #475569;
	}

	.letter-signature {
		font-style: italic;
		font-weight: 600;
		color: #1e293b;
		margin: 0;
	}

	:global(html[data-theme='dark']) .letter-signature {
		color: #e2e8f0;
	}

	/* Questions section */
	.questions-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.questions-title {
		font-size: 1.15rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0 0 0.15rem;
	}

	:global(html[data-theme='dark']) .questions-title {
		color: #f1f5f9;
	}

	.questions-subtitle {
		font-size: 0.85rem;
		color: #64748b;
		margin: 0 0 0.5rem;
	}

	.question-card {
		background: var(--card-bg, #fff);
		border: 1.5px solid var(--card-border, #e2e8f0);
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	:global(html[data-theme='dark']) .question-card {
		background: #1e293b;
		border-color: #334155;
	}

	.question-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.question-num {
		font-size: 0.78rem;
		font-weight: 800;
		color: #94a3b8;
		letter-spacing: 0.05em;
	}

	.question-badge {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.15rem 0.55rem;
		border-radius: 2rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.badge-mcq {
		background: #ddf4ff;
		color: #0284c7;
	}

	:global(html[data-theme='dark']) .badge-mcq {
		background: #0c4a6e;
		color: #7dd3fc;
	}

	.badge-fr {
		background: #f0fdf4;
		color: #16a34a;
	}

	:global(html[data-theme='dark']) .badge-fr {
		background: #052e16;
		color: #86efac;
	}

	.question-points {
		margin-left: auto;
		font-size: 0.78rem;
		font-weight: 700;
		color: #94a3b8;
	}

	.question-text {
		font-size: 0.97rem;
		font-weight: 600;
		color: #1e293b;
		margin: 0;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .question-text {
		color: #e2e8f0;
	}

	/* MCQ */
	.mcq-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mcq-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border: 1.5px solid var(--card-border, #e2e8f0);
		border-radius: 0.75rem;
		background: transparent;
		text-align: left;
		font-size: 0.93rem;
		font-weight: 500;
		color: #1e293b;
		cursor: pointer;
		transition: all 0.15s;
	}

	:global(html[data-theme='dark']) .mcq-option {
		border-color: #334155;
		color: #e2e8f0;
	}

	.mcq-option:hover:not(:disabled) {
		border-color: #1cb0f6;
		background: #f0f9ff;
	}

	:global(html[data-theme='dark']) .mcq-option:hover:not(:disabled) {
		background: #0c4a6e22;
	}

	.mcq-option.selected {
		border-color: #1cb0f6;
		background: #ddf4ff;
	}

	:global(html[data-theme='dark']) .mcq-option.selected {
		background: #0c2340;
	}

	.mcq-option.correct {
		border-color: #16a34a;
		background: #f0fdf4;
		color: #166534;
	}

	:global(html[data-theme='dark']) .mcq-option.correct {
		background: #052e16;
		color: #86efac;
	}

	.mcq-option.incorrect {
		border-color: #dc2626;
		background: #fef2f2;
		color: #991b1b;
	}

	:global(html[data-theme='dark']) .mcq-option.incorrect {
		background: #450a0a;
		color: #fca5a5;
	}

	.mcq-option.dimmed {
		opacity: 0.45;
	}

	.mcq-option:disabled {
		cursor: default;
	}

	.option-letter {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #e2e8f0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 800;
		flex-shrink: 0;
		color: #475569;
	}

	:global(html[data-theme='dark']) .option-letter {
		background: #334155;
		color: #94a3b8;
	}

	.mcq-option.correct .option-letter {
		background: #16a34a;
		color: #fff;
	}

	.mcq-option.incorrect .option-letter {
		background: #dc2626;
		color: #fff;
	}

	.mcq-result {
		font-size: 0.88rem;
		font-weight: 700;
		padding: 0.4rem 0.75rem;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.result-correct {
		background: #f0fdf4;
		color: #16a34a;
	}

	:global(html[data-theme='dark']) .result-correct {
		background: #052e16;
		color: #86efac;
	}

	.result-incorrect {
		background: #fef2f2;
		color: #dc2626;
	}

	:global(html[data-theme='dark']) .result-incorrect {
		background: #450a0a;
		color: #fca5a5;
	}

	.mcq-explanation {
		font-size: 0.85rem;
		color: #64748b;
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: #f8fafc;
		border-radius: 0.5rem;
		border-left: 3px solid #e2e8f0;
	}

	:global(html[data-theme='dark']) .mcq-explanation {
		background: #0f172a;
		color: #94a3b8;
		border-color: #334155;
	}

	/* Free response */
	.fr-input {
		width: 100%;
		min-height: 80px;
		padding: 0.75rem;
		border: 1.5px solid var(--card-border, #e2e8f0);
		border-radius: 0.75rem;
		font-size: 0.93rem;
		font-family: inherit;
		background: var(--card-bg, #fff);
		color: #1e293b;
		resize: vertical;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}

	:global(html[data-theme='dark']) .fr-input {
		background: #0f172a;
		border-color: #334155;
		color: #e2e8f0;
	}

	.fr-input:focus {
		outline: none;
		border-color: #1cb0f6;
	}

	.fr-input:disabled {
		opacity: 0.7;
	}

	.fr-submit-btn {
		padding: 0.6rem 1.25rem;
		background: #16a34a;
		color: #fff;
		border: none;
		border-radius: 0.6rem;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
		align-self: flex-start;
	}

	.fr-submit-btn:hover:not(:disabled) {
		background: #15803d;
	}

	.fr-submit-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.fr-result {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.fr-score-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.88rem;
		font-weight: 700;
		padding: 0.4rem 0.75rem;
		border-radius: 0.5rem;
	}

	.score-great {
		background: #f0fdf4;
		color: #16a34a;
	}

	:global(html[data-theme='dark']) .score-great {
		background: #052e16;
		color: #86efac;
	}

	.score-ok {
		background: #fff7ed;
		color: #c2410c;
	}

	:global(html[data-theme='dark']) .score-ok {
		background: #431407;
		color: #fb923c;
	}

	.score-poor {
		background: #fef2f2;
		color: #dc2626;
	}

	:global(html[data-theme='dark']) .score-poor {
		background: #450a0a;
		color: #fca5a5;
	}

	.fr-score-label {
		opacity: 0.7;
	}

	.fr-score-pct {
		font-size: 1rem;
	}

	.xp-badge {
		background: #fbbf24;
		color: #0f172a;
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.1rem 0.5rem;
		border-radius: 2rem;
		margin-left: 0.25rem;
	}

	.fr-feedback {
		font-size: 0.85rem;
		color: #475569;
		margin: 0;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .fr-feedback {
		color: #94a3b8;
	}

	.sample-answer-details {
		font-size: 0.85rem;
	}

	.sample-answer-details summary {
		cursor: pointer;
		color: #64748b;
		font-weight: 600;
		padding: 0.25rem 0;
	}

	.sample-answer-details p {
		margin: 0.5rem 0 0;
		color: #475569;
		padding: 0.5rem 0.75rem;
		background: #f8fafc;
		border-radius: 0.5rem;
	}

	:global(html[data-theme='dark']) .sample-answer-details p {
		background: #0f172a;
		color: #94a3b8;
	}

	/* Summary */
	.summary-card {
		background: var(--card-bg, #fff);
		border: 1.5px solid #a3e635;
		border-radius: 1.25rem;
		padding: 2rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	:global(html[data-theme='dark']) .summary-card {
		background: #1e293b;
	}

	.summary-icon {
		font-size: 2.5rem;
	}

	.summary-card h3 {
		font-size: 1.3rem;
		font-weight: 800;
		margin: 0;
		color: #1e293b;
	}

	:global(html[data-theme='dark']) .summary-card h3 {
		color: #f1f5f9;
	}

	.summary-xp {
		font-size: 1rem;
		color: #475569;
		margin: 0;
	}

	:global(html[data-theme='dark']) .summary-xp {
		color: #94a3b8;
	}

	.summary-xp strong {
		color: #16a34a;
	}
</style>
