<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import toast from 'svelte-french-toast';

	let {
		language = null,
		cefrLevel = 'A1',
		assignmentId = null,
		assignmentProgress = $bindable(null)
	}: {
		language?: { id?: string; name: string; flag?: string } | null;
		cefrLevel?: string;
		assignmentId?: string | null;
		assignmentProgress?: { score: number; targetScore: number; passed: boolean } | null;
	} = $props();

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

	let selectedMediaType: MediaType | 'random' = $state('random');
	let session = $state<ImmersionSession | null>(null);
	let loading = $state(false);
	let error = $state('');

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
	let answers: Record<string, AnswerState> = $state({});

	let totalXpEarned = $state(0);
	let sessionComplete = $state(false);
	let mcqXpAwarded = $state(false); // tracks if MCQ XP was awarded via API

	async function generate() {
		if (loading) return;
		loading = true;
		error = '';
		session = null;
		answers = {};
		totalXpEarned = 0;
		sessionComplete = false;
		wordPopup = null;
		wordLookupCache.clear();

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

	// Word lookup popup
	type WordPopup = {
		word: string;
		x: number;
		y: number;
		loading: boolean;
		result: any | null;
		error: string;
	};
	let wordPopup = $state<WordPopup | null>(null);

	const skeletonType = $derived(selectedMediaType === 'random' ? 'news_article' : selectedMediaType);
	let wordLookupCache = new Map<string, any>();

	function extractClickedWord(e: MouseEvent): string {
		const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
		if (!range) return '';
		const sel = window.getSelection();
		if (!sel) return '';
		sel.removeAllRanges();
		sel.addRange(range);
		sel.modify('expand', 'backward', 'word');
		sel.modify('extend', 'forward', 'word');
		const word = sel.toString().trim().replace(/[«»„""\[\]()\.,!?;:'"–—]/g, '').trim();
		sel.removeAllRanges();
		return word;
	}

	async function handleTemplateClick(e: MouseEvent) {
		if (!language?.id) return;
		const word = extractClickedWord(e);
		if (!word || word.length < 2 || /^\d+$/.test(word)) return;

		const x = Math.min(e.clientX, window.innerWidth - 290);
		const y = e.clientY + 16;

		if (wordLookupCache.has(word.toLowerCase())) {
			wordPopup = { word, x, y, loading: false, result: wordLookupCache.get(word.toLowerCase()), error: '' };
			return;
		}

		wordPopup = { word, x, y, loading: true, result: null, error: '' };

		try {
			const res = await fetch('/api/vocabulary/llm-lookup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ word, languageId: language.id })
			});
			const data = await res.json();
			if (data.success && data.data) {
				wordLookupCache.set(word.toLowerCase(), data.data);
				wordPopup = { word, x, y, loading: false, result: data.data, error: '' };
			} else {
				wordPopup = { word, x, y, loading: false, result: null, error: data.error || 'Word not found.' };
			}
		} catch {
			wordPopup = { word, x, y, loading: false, result: null, error: 'Lookup failed.' };
		}
	}

	function closeWordPopup() {
		wordPopup = null;
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

	const allAnswered = $derived(
		session?.questions.every((q) => {
			const a = answers[q.id];
			if (q.type === 'multiple_choice') return a?.mcqSubmitted;
			if (q.type === 'free_response') return a?.frSubmitted;
			return false;
		}) ?? false
	);

	const pendingFreeResponses = $derived(
		session?.questions.filter(
			(q) => q.type === 'free_response' && !answers[q.id]?.frSubmitted
		) ?? []
	);

	// Bookmarks (#16) — persisted to localStorage
	const BOOKMARK_KEY = 'immersion_bookmarks';
	const MAX_BOOKMARKS = 10;

	type Bookmark = {
		id: string;
		savedAt: string;
		mediaType: MediaType;
		mediaLabel: string;
		headline: string; // best title field we can extract
		session: ImmersionSession;
	};

	let bookmarks: Bookmark[] = $state([]);
	let showBookmarks = $state(false);

	import { onMount } from 'svelte';
	onMount(() => {
		try {
			bookmarks = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
		} catch { bookmarks = []; }

		function handleOutsideClick(e: MouseEvent) {
			if (!wordPopup) return;
			const popup = document.querySelector('.word-popup');
			if (popup && !popup.contains(e.target as Node)) {
				const mediaCard = document.querySelector('.media-card');
				// If clicking inside the media card, let handleTemplateClick handle it
				if (mediaCard && mediaCard.contains(e.target as Node)) return;
				wordPopup = null;
			}
		}
		document.addEventListener('click', handleOutsideClick);
		return () => document.removeEventListener('click', handleOutsideClick);
	});

	const isBookmarked = $derived(session ? bookmarks.some((b) => b.id === sessionId(session!)) : false);

	function sessionId(s: ImmersionSession): string {
		// Use first question text as a stable identifier
		return btoa(encodeURIComponent(s.questions[0]?.question || JSON.stringify(s).slice(0, 80))).slice(0, 24);
	}

	function getHeadline(s: ImmersionSession): string {
		const d = s.templateData;
		return d.headline || d.title || d.restaurantName || d.brand || d.subject || 'Immersion Content';
	}

	function toggleBookmark() {
		if (!session) return;
		const id = sessionId(session);
		if (isBookmarked) {
			bookmarks = bookmarks.filter((b) => b.id !== id);
		} else {
			const bm: Bookmark = {
				id,
				savedAt: new Date().toISOString(),
				mediaType: session.mediaType,
				mediaLabel: MEDIA_LABELS[session.mediaType]?.label ?? session.mediaType,
				headline: getHeadline(session),
				session
			};
			bookmarks = [bm, ...bookmarks].slice(0, MAX_BOOKMARKS);
		}
		localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
	}

	function loadBookmark(bm: Bookmark) {
		session = bm.session;
		answers = {};
		totalXpEarned = 0;
		sessionComplete = false;
		showBookmarks = false;
	}

	function deleteBookmark(id: string) {
		bookmarks = bookmarks.filter((b) => b.id !== id);
		localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
	}
</script>

<!-- Word lookup popup (fixed to viewport to avoid overflow:hidden clipping) -->
{#if wordPopup}
	<div
		class="word-popup"
		role="dialog"
		aria-label="Word lookup"
		tabindex="-1"
		style="left:{wordPopup.x}px;top:{wordPopup.y}px"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
	>
		<div class="word-popup-header">
			<span class="word-popup-word">{wordPopup.word}</span>
			<button class="word-popup-close" onclick={closeWordPopup} aria-label="Close">×</button>
		</div>
		{#if wordPopup.loading}
			<div class="word-popup-loading">
				<span class="spinner"></span>
				Looking up...
			</div>
		{:else if wordPopup.result}
			{@const r = wordPopup.result}
			<div class="word-popup-lemma">{r.lemma}{r.gender === 'MASCULINE' ? ' (der)' : r.gender === 'FEMININE' ? ' (die)' : r.gender === 'NEUTER' ? ' (das)' : ''}</div>
			{#each (r.meanings || []).slice(0, 3) as m}
				<div class="word-popup-meaning">
					{#if m.partOfSpeech}<span class="word-popup-pos">{m.partOfSpeech}</span>{/if}
					{m.value}
				</div>
			{/each}
		{:else if wordPopup.error}
			<div class="word-popup-error">{wordPopup.error}</div>
		{/if}
	</div>
{/if}

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
						onclick={() => (selectedMediaType = type)}
					>
						{type === 'random'
							? '🎲 Random'
							: MEDIA_LABELS[type].icon + ' ' + MEDIA_LABELS[type].label}
					</button>
				{/each}
			</div>
		</div>

		<div class="generate-row">
			<button class="generate-btn" onclick={generate} disabled={loading}>
				{#if loading}
					<span class="spinner"></span>
					Generating...
				{:else if session}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;flex-shrink:0;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
					Generate New
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;flex-shrink:0;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
					Generate Content
				{/if}
			</button>

			<!-- Bookmark actions (#16) -->
			<div class="bookmark-actions">
				{#if session}
					<button
						class="bookmark-btn"
						class:bookmarked={isBookmarked}
						onclick={toggleBookmark}
						title={isBookmarked ? 'Remove bookmark' : 'Save this content'}
						aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this content'}
					>
						<svg viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" aria-hidden="true" width="18" height="18">
							<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
						</svg>
					</button>
				{/if}
				{#if bookmarks.length > 0}
					<button
						class="bookmark-list-btn"
						onclick={() => showBookmarks = !showBookmarks}
						title="Saved content"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" width="16" height="16">
							<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
						</svg>
						{bookmarks.length}
					</button>
				{/if}
			</div>
		</div>

		<!-- Bookmarks panel (#16) -->
		{#if showBookmarks}
			<div class="bookmarks-panel" in:fly={{ y: -8, duration: 200 }}>
				<p class="bookmarks-panel-title">Saved Content</p>
				<ul class="bookmarks-list">
					{#each bookmarks as bm}
						<li class="bookmark-item">
							<button class="bookmark-load-btn" onclick={() => loadBookmark(bm)}>
								<span class="bookmark-icon">{MEDIA_LABELS[bm.mediaType]?.icon ?? '📄'}</span>
								<span class="bookmark-headline">{bm.headline}</span>
								<span class="bookmark-type">{bm.mediaLabel}</span>
							</button>
							<button class="bookmark-delete-btn" onclick={() => deleteBookmark(bm.id)} aria-label="Delete bookmark" title="Remove">
								&times;
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="loading-card skeleton-card" in:fade={{ duration: 200 }} aria-busy="true" aria-label="Generating content">
			<!-- Shared: media type badge -->
			<div class="skeleton-badge"></div>

			{#if skeletonType === 'news_article'}
				<!-- Source bar: two short pills side by side -->
				<div class="skeleton-row">
					<div class="skeleton-pill" style="width:5rem"></div>
					<div class="skeleton-pill" style="width:4rem"></div>
				</div>
				<div class="skeleton-headline"></div>
				<div class="skeleton-byline"></div>
				<div class="skeleton-rule"></div>
				<div class="skeleton-line"></div>
				<div class="skeleton-line skeleton-line-short"></div>
				<div class="skeleton-line"></div>
				<div class="skeleton-line" style="width:85%"></div>
				<div class="skeleton-line skeleton-line-short"></div>

			{:else if skeletonType === 'advertisement'}
				<!-- Brand + product + slogan + feature bullets + price + CTA -->
				<div class="skeleton-pill" style="width:6rem;margin-bottom:0.5rem"></div>
				<div class="skeleton-headline" style="width:70%"></div>
				<div class="skeleton-line" style="width:55%;font-style:italic"></div>
				<div class="skeleton-bullet-list">
					<div class="skeleton-bullet"></div>
					<div class="skeleton-bullet"></div>
					<div class="skeleton-bullet"></div>
				</div>
				<div class="skeleton-pill" style="width:4rem;margin-top:0.5rem"></div>
				<div class="skeleton-cta-btn"></div>

			{:else if skeletonType === 'restaurant_menu'}
				<!-- Restaurant name + tagline + 2 sections with items -->
				<div class="skeleton-headline" style="width:60%;text-align:center;margin:0 auto 0.5rem"></div>
				<div class="skeleton-line" style="width:45%;margin:0 auto 1.25rem"></div>
				<div class="skeleton-section-title"></div>
				<div class="skeleton-menu-item">
					<div style="flex:1"><div class="skeleton-line" style="width:55%"></div><div class="skeleton-line skeleton-line-short"></div></div>
					<div class="skeleton-pill" style="width:2.5rem"></div>
				</div>
				<div class="skeleton-menu-item">
					<div style="flex:1"><div class="skeleton-line" style="width:65%"></div><div class="skeleton-line skeleton-line-short"></div></div>
					<div class="skeleton-pill" style="width:2.5rem"></div>
				</div>
				<div class="skeleton-section-title" style="margin-top:1rem"></div>
				<div class="skeleton-menu-item">
					<div style="flex:1"><div class="skeleton-line" style="width:50%"></div><div class="skeleton-line skeleton-line-short"></div></div>
					<div class="skeleton-pill" style="width:2.5rem"></div>
				</div>

			{:else if skeletonType === 'social_post'}
				<!-- Avatar + username/handle + timestamp + content + hashtags + stats -->
				<div class="skeleton-social-header">
					<div class="skeleton-avatar"></div>
					<div class="skeleton-social-meta">
						<div class="skeleton-line" style="width:7rem;height:0.85rem"></div>
						<div class="skeleton-line" style="width:5rem;height:0.75rem;margin-top:0.25rem"></div>
					</div>
					<div class="skeleton-pill" style="width:3rem;margin-left:auto"></div>
				</div>
				<div class="skeleton-line" style="margin-top:0.75rem"></div>
				<div class="skeleton-line"></div>
				<div class="skeleton-line skeleton-line-short"></div>
				<div class="skeleton-row" style="margin-top:0.5rem;gap:0.5rem">
					<div class="skeleton-pill" style="width:4rem"></div>
					<div class="skeleton-pill" style="width:4rem"></div>
					<div class="skeleton-pill" style="width:4rem"></div>
				</div>
				<div class="skeleton-row" style="margin-top:0.75rem">
					<div class="skeleton-pill" style="width:3.5rem"></div>
					<div class="skeleton-pill" style="width:3.5rem"></div>
				</div>

			{:else if skeletonType === 'recipe'}
				<!-- Title + meta chips + two-column: ingredients / steps -->
				<div class="skeleton-headline" style="width:70%"></div>
				<div class="skeleton-row" style="flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem">
					<div class="skeleton-pill" style="width:6rem"></div>
					<div class="skeleton-pill" style="width:7rem"></div>
					<div class="skeleton-pill" style="width:5rem"></div>
				</div>
				<div class="skeleton-recipe-cols">
					<div class="skeleton-col">
						<div class="skeleton-section-title" style="width:60%"></div>
						<div class="skeleton-bullet"></div>
						<div class="skeleton-bullet"></div>
						<div class="skeleton-bullet"></div>
						<div class="skeleton-bullet" style="width:55%"></div>
					</div>
					<div class="skeleton-col">
						<div class="skeleton-section-title" style="width:70%"></div>
						<div class="skeleton-line"></div>
						<div class="skeleton-line skeleton-line-short"></div>
						<div class="skeleton-line"></div>
						<div class="skeleton-line" style="width:80%"></div>
					</div>
				</div>

			{:else if skeletonType === 'review'}
				<!-- Subject + stars + author/date + body + verdict -->
				<div class="skeleton-row" style="align-items:flex-start;justify-content:space-between">
					<div>
						<div class="skeleton-headline" style="width:12rem"></div>
						<div class="skeleton-pill" style="width:5rem;margin-top:0.4rem"></div>
					</div>
					<div style="text-align:right">
						<div class="skeleton-line" style="width:6rem;height:0.8rem"></div>
						<div class="skeleton-line" style="width:4rem;height:0.75rem;margin-top:0.3rem"></div>
					</div>
				</div>
				<div class="skeleton-line" style="margin-top:0.75rem"></div>
				<div class="skeleton-line"></div>
				<div class="skeleton-line skeleton-line-short"></div>
				<div class="skeleton-verdict"></div>

			{:else if skeletonType === 'letter'}
				<!-- Location/date, salutation, body paragraphs, closing, signature -->
				<div class="skeleton-line" style="width:10rem;margin-bottom:1rem"></div>
				<div class="skeleton-line" style="width:8rem;margin-bottom:0.75rem"></div>
				<div class="skeleton-line"></div>
				<div class="skeleton-line"></div>
				<div class="skeleton-line skeleton-line-short"></div>
				<div class="skeleton-line" style="margin-top:0.5rem"></div>
				<div class="skeleton-line" style="width:80%"></div>
				<div class="skeleton-line" style="width:6rem;margin-top:1rem"></div>
				<div class="skeleton-line" style="width:8rem;margin-top:0.25rem"></div>
			{/if}

			<div class="skeleton-hint">Generating your {selectedMediaType === 'random' ? 'content' : selectedMediaType.replace(/_/g, ' ')}...</div>
		</div>
	{/if}

	{#if session && !loading}
		<div class="session-wrapper" in:fly={{ y: 20, duration: 400 }}>
			<!-- Media template -->
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div class="media-card" onclick={handleTemplateClick} role="button" tabindex="0" aria-label="Reading content">
				<div class="media-type-badge">
					{MEDIA_LABELS[session.mediaType].icon}
					{MEDIA_LABELS[session.mediaType].label}
					{#if language?.id}
						<span class="word-click-hint">· tap a word to look it up</span>
					{/if}
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
				<div class="questions-header">
					<h3 class="questions-title">Comprehension Questions</h3>
					<span class="questions-progress">{session.questions.filter(q => { const s = answers[q.id] || {}; return s.mcqSubmitted || s.frSubmitted; }).length} / {session.questions.length}</span>
				</div>
				<div class="questions-progress-bar">
					<div class="questions-progress-fill" style="width: {session.questions.length > 0 ? (session.questions.filter(q => { const s = answers[q.id] || {}; return s.mcqSubmitted || s.frSubmitted; }).length / session.questions.length) * 100 : 0}%"></div>
				</div>
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
										onclick={() => handleMcqSelect(question.id, idx, question)}
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
								oninput={() => { answers[question.id] = state; answers = answers; }}
							></textarea>
							{#if !state.frSubmitted}
								<button
									class="fr-submit-btn"
									disabled={!state.frText?.trim() || state.frSubmitting}
									onclick={() => submitFreeResponse(question)}
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
					<button class="generate-btn" onclick={generate}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:1.1rem;height:1.1rem;flex-shrink:0;"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
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

	.generate-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	/* Bookmark styles (#16) */
	.bookmark-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.bookmark-btn {
		background: none;
		border: 2px solid rgba(255,255,255,0.2);
		border-radius: 0.6rem;
		padding: 0.55rem;
		cursor: pointer;
		color: rgba(255,255,255,0.5);
		display: flex;
		align-items: center;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
		line-height: 0;
	}

	.bookmark-btn:hover { color: #fbbf24; border-color: #fbbf24; }

	.bookmark-btn.bookmarked {
		color: #fbbf24;
		border-color: #fbbf24;
		background: rgba(251, 191, 36, 0.1);
	}

	.bookmark-list-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(255,255,255,0.08);
		border: 2px solid rgba(255,255,255,0.15);
		border-radius: 0.6rem;
		padding: 0.45rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 700;
		color: rgba(255,255,255,0.6);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.bookmark-list-btn:hover {
		background: rgba(255,255,255,0.15);
		color: #fff;
	}

	.bookmarks-panel {
		background: rgba(255,255,255,0.06);
		border: 1px solid rgba(255,255,255,0.12);
		border-radius: 0.75rem;
		padding: 0.75rem;
		margin-top: 0.5rem;
	}

	.bookmarks-panel-title {
		font-size: 0.65rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(255,255,255,0.4);
		margin: 0 0 0.5rem;
	}

	.bookmarks-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.bookmark-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.bookmark-load-btn {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
		min-width: 0;
		font-family: inherit;
	}

	.bookmark-load-btn:hover { background: rgba(255,255,255,0.1); }

	.bookmark-icon { font-size: 1rem; flex-shrink: 0; }

	.bookmark-headline {
		flex: 1;
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bookmark-type {
		font-size: 0.65rem;
		font-weight: 700;
		color: rgba(255,255,255,0.35);
		flex-shrink: 0;
	}

	.bookmark-delete-btn {
		background: none;
		border: none;
		color: rgba(255,255,255,0.3);
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.25rem 0.4rem;
		border-radius: 0.35rem;
		line-height: 1;
		transition: color 0.15s, background 0.15s;
		flex-shrink: 0;
	}

	.bookmark-delete-btn:hover { color: #f87171; background: rgba(248,113,113,0.1); }

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
		gap: 0.625rem;
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

	/* Skeleton card styles */
	@keyframes skeleton-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* Base pulse applied to all skeleton shapes */
	.skeleton-badge,
	.skeleton-headline,
	.skeleton-byline,
	.skeleton-rule,
	.skeleton-line,
	.skeleton-pill,
	.skeleton-bullet,
	.skeleton-cta-btn,
	.skeleton-avatar,
	.skeleton-section-title,
	.skeleton-verdict {
		background: var(--card-border, #e2e8f0);
		border-radius: 0.375rem;
		animation: skeleton-pulse 1.5s ease-in-out infinite;
	}

	.skeleton-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	/* Badge — media type chip at top */
	.skeleton-badge {
		height: 1.5rem;
		width: 8rem;
		border-radius: 999px;
		margin-bottom: 0.75rem;
	}

	/* Large title line */
	.skeleton-headline {
		height: 1.75rem;
		width: 80%;
	}

	/* Byline / subtitle */
	.skeleton-byline {
		height: 0.85rem;
		width: 45%;
	}

	/* Horizontal rule (news) */
	.skeleton-rule {
		height: 1px;
		width: 100%;
		margin: 0.5rem 0;
		opacity: 0.5;
	}

	/* Body text line */
	.skeleton-line {
		height: 0.9rem;
		width: 100%;
	}

	.skeleton-line-short {
		width: 65%;
	}

	/* Small rounded chip (hashtag, price, meta) */
	.skeleton-pill {
		height: 1.25rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	/* Bullet-list items */
	.skeleton-bullet-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-left: 1rem;
		margin: 0.25rem 0;
	}

	.skeleton-bullet {
		height: 0.85rem;
		width: 75%;
		position: relative;
	}

	.skeleton-bullet::before {
		content: '';
		position: absolute;
		left: -0.875rem;
		top: 50%;
		transform: translateY(-50%);
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--card-border, #e2e8f0);
	}

	/* Ad CTA button shape */
	.skeleton-cta-btn {
		height: 2.25rem;
		width: 60%;
		border-radius: 0.5rem;
		margin: 0.5rem auto 0;
	}

	/* Social avatar circle */
	.skeleton-avatar {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* Social post header row */
	.skeleton-social-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.skeleton-social-meta {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	/* Horizontal flex row helper */
	.skeleton-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	/* Section title (menu section, recipe section) */
	.skeleton-section-title {
		height: 1.1rem;
		width: 40%;
		margin: 0.5rem 0 0.4rem;
	}

	/* Menu row: name+desc left, price right */
	.skeleton-menu-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid var(--card-border, #e2e8f0);
	}

	/* Recipe two-column layout */
	.skeleton-recipe-cols {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-top: 0.5rem;
	}

	.skeleton-col {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	/* Review verdict bar */
	.skeleton-verdict {
		height: 2.5rem;
		width: 100%;
		border-radius: 0.5rem;
		margin-top: 0.5rem;
	}

	.skeleton-hint {
		margin-top: 1.25rem;
		color: #94a3b8;
		font-size: 0.875rem;
		text-align: center;
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
		cursor: text;
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

	.questions-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: -0.25rem;
	}

	.questions-progress {
		font-size: 0.8rem;
		font-weight: 700;
		color: #64748b;
		background: #f1f5f9;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
	}

	:global(html[data-theme='dark']) .questions-progress {
		background: #1e293b;
		color: #94a3b8;
	}

	.questions-progress-bar {
		height: 4px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 0.25rem;
	}

	.questions-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #1cb0f6, #7c3aed);
		border-radius: 999px;
		transition: width 0.4s ease;
	}

	:global(html[data-theme='dark']) .questions-progress-bar {
		background: #334155;
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

	/* Word click hint */
	.word-click-hint {
		font-size: 0.72rem;
		font-weight: 500;
		color: #94a3b8;
		margin-left: 0.4rem;
		letter-spacing: 0;
		text-transform: none;
	}

	/* Word lookup popup */
	.word-popup {
		position: fixed;
		z-index: 200;
		background: #fff;
		border: 1.5px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		min-width: 200px;
		max-width: 280px;
		box-shadow: 0 8px 24px rgba(0,0,0,0.12);
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	:global(html[data-theme='dark']) .word-popup {
		background: #1e293b;
		border-color: #475569;
		box-shadow: 0 8px 24px rgba(0,0,0,0.4);
	}

	.word-popup-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.word-popup-word {
		font-size: 1rem;
		font-weight: 800;
		color: #0f172a;
	}

	:global(html[data-theme='dark']) .word-popup-word {
		color: #f1f5f9;
	}

	.word-popup-close {
		background: none;
		border: none;
		font-size: 1.2rem;
		line-height: 1;
		color: #94a3b8;
		cursor: pointer;
		padding: 0 0.2rem;
		flex-shrink: 0;
	}

	.word-popup-close:hover { color: #475569; }

	.word-popup-lemma {
		font-size: 0.82rem;
		font-weight: 600;
		color: #7c3aed;
	}

	:global(html[data-theme='dark']) .word-popup-lemma {
		color: #a78bfa;
	}

	.word-popup-meaning {
		font-size: 0.88rem;
		color: #334155;
		line-height: 1.4;
		display: flex;
		gap: 0.35rem;
		align-items: baseline;
	}

	:global(html[data-theme='dark']) .word-popup-meaning {
		color: #cbd5e1;
	}

	.word-popup-pos {
		font-size: 0.7rem;
		font-weight: 700;
		color: #94a3b8;
		background: #f1f5f9;
		padding: 0.05rem 0.35rem;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	:global(html[data-theme='dark']) .word-popup-pos {
		background: #0f172a;
		color: #64748b;
	}

	.word-popup-loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: #64748b;
	}

	.word-popup-error {
		font-size: 0.82rem;
		color: #94a3b8;
	}
</style>
