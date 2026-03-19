<script lang="ts">
  import { onMount } from 'svelte';
  import toast from 'svelte-french-toast';
  import { getLanguageConfig } from '$lib/languages';

  // Sub-components
  import WordPopup from './immersion/WordPopup.svelte';
  import ImmersionControls from './immersion/ImmersionControls.svelte';
  import ImmersionSkeleton from './immersion/ImmersionSkeleton.svelte';
  import MediaCard from './immersion/MediaCard.svelte';
  import QuestionSection from './immersion/QuestionSection.svelte';
  import SessionSummary from './immersion/SessionSummary.svelte';

  let {
    language = null,
    cefrLevel: _cefrLevel = 'A1',
    assignmentId = null,
    assignmentProgress = $bindable(null),
    disableHoverTranslation = false
  }: {
    language?: { id?: string; name: string; flag?: string } | null;
    cefrLevel?: string;
    assignmentId?: string | null;
    assignmentProgress?: { score: number; targetScore: number; passed: boolean } | null;
    disableHoverTranslation?: boolean;
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

  type ImmersionDestination = {
    city: string;
    country: string;
    emoji: string;
    description: string;
  };

  type ImmersionSession = {
    mediaType: MediaType;
    templateData: Record<string, any>;
    questions: Question[];
    vocabIds: string[];
    destination: ImmersionDestination | null;
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

  type Destination = { city: string; country: string; emoji: string; description: string };

  let selectedMediaType: MediaType | 'random' = $state('random');
  let session = $state<ImmersionSession | null>(null);
  let loading = $state(false);
  let error = $state('');
  let loadingDestination = $state<Destination | null>(null);

  // Answer tracking
  type AnswerState = {
    selectedOption?: number;
    mcqSubmitted?: boolean;
    mcqCorrect?: boolean;
    frText?: string;
    frSubmitting?: boolean;
    frScore?: number;
    frFeedback?: string;
    frSubmitted?: boolean;
  };
  let answers: Record<string, AnswerState> = $state({});

  let totalXpEarned = $state(0);
  let sessionComplete = $state(false);

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
    wordInflightSet.clear();

    const dests = langConfig.destinations;
    const chosenDest = dests[Math.floor(Math.random() * dests.length)];
    loadingDestination = chosenDest;

    try {
      const res = await fetch('/api/immersion/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaType: selectedMediaType, destinationCity: chosenDest?.city })
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

  // Word lookup popup state
  type WordPopupType = {
    word: string;
    x: number;
    y: number;
    loading: boolean;
    result: any | null;
    error: string;
  };
  let wordPopup = $state<WordPopupType | null>(null);
  let wordAddedSet = $state(new Set<string>());
  let wordAddingId = $state<string | null>(null);

  const skeletonType = $derived(
    selectedMediaType === 'random' ? 'news_article' : selectedMediaType
  );
  let wordLookupCache = new Map<string, any>();
  let wordInflightSet = new Set<string>();

  async function addWordToVocabulary(vocabularyId: string) {
    if (!vocabularyId || wordAddedSet.has(vocabularyId) || wordAddingId) return;
    wordAddingId = vocabularyId;
    try {
      const res = await fetch('/api/user/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vocabularyId })
      });
      if (res.ok) {
        wordAddedSet = new Set([...wordAddedSet, vocabularyId]);
      }
    } catch {
      /* non-critical */
    } finally {
      wordAddingId = null;
    }
  }

  function cleanWord(raw: string): string {
    return raw.replace(/^[«»„""[\]().,!?;:'"–—]+|[«»„""[\]().,!?;:'"–—]+$/g, '').trim();
  }

  let langConfig = $derived(getLanguageConfig(language?.name || 'German'));

  function isSparseMeta(vocab: any): boolean {
    if (!vocab?.meanings?.length) return true;
    const isNoun = vocab.partOfSpeech === 'noun';
    if (isNoun && langConfig.hasGender && !vocab.gender) return true;
    const meta = vocab?.metadata;
    if (!meta) return true;
    return !(meta.example || meta.declensions || meta.conjugations);
  }

  async function handleWordClick(e: MouseEvent | KeyboardEvent, rawWord: string) {
    if (disableHoverTranslation || !language?.id) return;
    const word = cleanWord(rawWord);
    if (!word || word.length < 2 || /^\d+$/.test(word)) return;
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let x = Math.min(rect.left, window.innerWidth - 260);
    x = Math.max(0, x);
    let y = Math.min(rect.bottom + 6, window.innerHeight - 200);
    y = Math.max(0, y);

    const wordKey = word.toLowerCase();

    if (wordLookupCache.has(wordKey)) {
      wordPopup = { word, x, y, loading: false, result: wordLookupCache.get(wordKey), error: '' };
      return;
    }

    if (wordInflightSet.has(wordKey)) {
      if (!wordPopup || wordPopup.word !== word) {
        wordPopup = { word, x, y, loading: true, result: null, error: '' };
      }
      return;
    }

    wordPopup = { word, x, y, loading: true, result: null, error: '' };
    let dbVocab: any = null;
    try {
      const dbRes = await fetch(`/api/vocabulary/search?q=${encodeURIComponent(word)}`);
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        dbVocab =
          dbData.results?.find((r: any) => r.lemma.toLowerCase() === word.toLowerCase()) ?? null;
      }
    } catch {
      /* non-critical */
    }

    if (dbVocab) {
      wordPopup = { word, x, y, loading: false, result: dbVocab, error: '' };
      if (!isSparseMeta(dbVocab)) {
        wordLookupCache.set(wordKey, dbVocab);
        return;
      }
    }

    const enriching = !!dbVocab;
    if (!enriching) {
      wordPopup = { word, x, y, loading: true, result: null, error: '' };
    }

    wordInflightSet.add(wordKey);
    try {
      const res = await fetch('/api/vocabulary/llm-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          languageId: language.id,
          ...(dbVocab?.id ? { existingId: dbVocab.id } : {})
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        wordLookupCache.set(wordKey, data.data);
        if (wordPopup?.word === word) {
          wordPopup = { word, x, y, loading: false, result: data.data, error: '' };
        }
      } else if (!enriching) {
        if (wordPopup?.word === word) {
          wordPopup = {
            word,
            x,
            y,
            loading: false,
            result: null,
            error: data.error || 'Word not found.'
          };
        }
      }
    } catch {
      if (!enriching && wordPopup?.word === word) {
        wordPopup = { word, x, y, loading: false, result: null, error: 'Lookup failed.' };
      }
    } finally {
      wordInflightSet.delete(wordKey);
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
    answers = answers;

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
          assignmentId,
          vocabIds: session?.vocabIds ?? []
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
    } catch (_) {
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
      let mcqXp = 0;
      session.questions.forEach((q) => {
        if (q.type === 'multiple_choice' && answers[q.id]?.mcqCorrect) {
          mcqXp += q.points;
        }
      });
      if (mcqXp > 0 && !assignmentId) {
        totalXpEarned += mcqXp;
        fetch('/api/immersion/grade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ directXp: mcqXp })
        }).catch(() => {});
      }
    }
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

  // Bookmarks
  const BOOKMARK_KEY = 'immersion_bookmarks';
  const MAX_BOOKMARKS = 10;

  type Bookmark = {
    id: string;
    savedAt: string;
    mediaType: MediaType;
    mediaLabel: string;
    headline: string;
    session: ImmersionSession;
  };

  let bookmarks: Bookmark[] = $state([]);
  let showBookmarks = $state(false);

  onMount(() => {
    try {
      bookmarks = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
    } catch {
      bookmarks = [];
    }

    function handleOutsideClick(e: MouseEvent) {
      if (!wordPopup) return;
      const popup = document.querySelector('.word-popup');
      if (popup && !popup.contains(e.target as Node)) {
        const mediaCard = document.querySelector('.media-card');
        if (mediaCard && mediaCard.contains(e.target as Node)) return;
        wordPopup = null;
      }
    }
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  });

  const isBookmarked = $derived(
    session ? bookmarks.some((b) => b.id === sessionId(session!)) : false
  );

  function sessionId(s: ImmersionSession): string {
    return btoa(
      encodeURIComponent(s.questions[0]?.question || JSON.stringify(s).slice(0, 80))
    ).slice(0, 24);
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

{#if wordPopup}
  <WordPopup {wordPopup} {wordAddedSet} {wordAddingId} {closeWordPopup} {addWordToVocabulary} />
{/if}

<div class="immersion-root">
  <ImmersionControls
    bind:selectedMediaType
    {loading}
    {session}
    {isBookmarked}
    {bookmarks}
    bind:showBookmarks
    {MEDIA_TYPES}
    {MEDIA_LABELS}
    {language}
    onGenerate={generate}
    onToggleBookmark={toggleBookmark}
    onLoadBookmark={loadBookmark}
    onDeleteBookmark={deleteBookmark}
  />

  {#if loading}
    <ImmersionSkeleton {skeletonType} {selectedMediaType} {loadingDestination} />
  {/if}

  {#if session && !loading}
    <MediaCard
      {session}
      {language}
      {disableHoverTranslation}
      {MEDIA_LABELS}
      onWordClick={handleWordClick}
    />

    <QuestionSection
      {session}
      bind:answers
      onMcqSelect={handleMcqSelect}
      onSubmitFreeResponse={submitFreeResponse}
      {getScoreClass}
    />

    {#if allAnswered}
      <SessionSummary {totalXpEarned} onGenerate={generate} />
    {/if}
  {/if}
</div>

<style>
  .immersion-root {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 760px;
    margin: 0 auto;
    padding-bottom: 2rem;
  }
</style>
