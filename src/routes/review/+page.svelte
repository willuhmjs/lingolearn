<script lang="ts">
  import type { PageData } from './$types';
  import Confetti from '$lib/components/Confetti.svelte';
  import { haptics } from '$lib/utils/haptic';
  import toast from 'svelte-french-toast';
  import { page } from '$app/stores';
  import ReviewHeader from '$lib/components/review/ReviewHeader.svelte';
  import KeyboardShortcutsModal from '$lib/components/review/KeyboardShortcutsModal.svelte';
  import NoReviewsCard from '$lib/components/review/NoReviewsCard.svelte';
  import SessionStartCard from '$lib/components/review/SessionStartCard.svelte';
  import SessionSummary from '$lib/components/review/SessionSummary.svelte';
  import ReviewCard from '$lib/components/review/ReviewCard.svelte';

  let { data }: { data: PageData } = $props();

  let sessionStarted = $state(false);
  let currentReviewIndex = $state(0);
  let isSubmitting = $state(false);
  let isGrading = $state(false);
  let typedAnswer = $state('');
  let reviewCardStartMs: number | null = $state(null);
  let reviewDirection: 'forward' | 'back' = $state('forward');

  let gradeResult: { correct: boolean; score: number } | null = $state(null);
  let userOverride: boolean | null = $state(null);
  let showKeyboardHelp = $state(false);
  let triggerConfetti = $state(false);
  let confettiFired = $state(false);

  // Copy-to-clipboard
  let reviewCopied = $state(false);
  async function copyReviewWord() {
    try {
      const text = currentReview?.vocabulary?.lemma || '';
      await navigator.clipboard.writeText(text);
      reviewCopied = true;
      setTimeout(() => {
        reviewCopied = false;
      }, 1500);
    } catch {
      /* unavailable */
    }
  }

  // Session summary tracking
  type ReviewResult = { lemma: string; correct: boolean; answer: string; correctMeaning: string };
  let sessionResults: ReviewResult[] = $state([]);

  // Undo history
  type UndoEntry = { index: number; result: ReviewResult };
  let undoStack: UndoEntry[] = $state([]);

  let activeLangName = $derived($page.data.user?.activeLanguage?.name || 'en');
  let dueReviews = $derived(data.dueReviews || []);
  let currentReview = $derived(dueReviews[currentReviewIndex]);
  let isFinished = $derived(
    sessionStarted && (dueReviews.length === 0 || currentReviewIndex >= dueReviews.length)
  );
  let hasNoReviews = $derived(!sessionStarted && dueReviews.length === 0);
  let showingAnswer = $derived(gradeResult !== null);
  let canUndo = $derived(undoStack.length > 0 && !showingAnswer);

  let effectiveCorrect = $derived(
    userOverride !== null ? userOverride : (gradeResult?.correct ?? false)
  );
  let effectiveScore = $derived(
    userOverride !== null ? (userOverride ? 1.0 : 0.0) : (gradeResult?.score ?? 0)
  );

  // Summary stats
  let correctCount = $derived(sessionResults.filter((r) => r.correct).length);
  let accuracyPct = $derived(
    sessionResults.length > 0 ? Math.round((correctCount / sessionResults.length) * 100) : 0
  );

  // Trigger confetti on perfect session
  $effect(() => {
    if (isFinished && accuracyPct === 100 && sessionResults.length > 0 && !confettiFired) {
      confettiFired = true;
      triggerConfetti = true;
      setTimeout(() => {
        triggerConfetti = false;
      }, 100);
    }
  });

  // Enhanced keyboard shortcuts
  function handleGlobalKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    const isInputField = tag === 'input' || tag === 'textarea';

    // Ctrl+Z / Cmd+Z: Undo last card
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && sessionStarted && !isFinished) {
      e.preventDefault();
      undoLast();
      return;
    }

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
  }

  function reportError() {
    toast('Error reporting coming soon — thanks for the feedback!', { duration: 4000 });
  }

  let lastResponseTimeMs: number | null = $state(null);

  async function showAnswer() {
    if (isGrading) return;

    haptics.medium();

    if (!typedAnswer.trim()) {
      gradeResult = { correct: false, score: 0 };
      haptics.error();
      return;
    }

    // Capture response time at the moment the user submits their answer
    lastResponseTimeMs = reviewCardStartMs !== null ? Date.now() - reviewCardStartMs : null;

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

    haptics.medium();

    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vocabularyId: currentReview.vocabulary.id,
          score: effectiveScore,
          overridden: userOverride !== null,
          responseTimeMs: lastResponseTimeMs
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

        reviewDirection = 'forward';
        currentReviewIndex++;
        gradeResult = null;
        userOverride = null;
        typedAnswer = '';
        lastResponseTimeMs = null;
        reviewCardStartMs = Date.now();
      }
    } catch (e) {
      console.error('Failed to submit review', e);
    } finally {
      isSubmitting = false;
    }
  }

  function toggleOverride() {
    haptics.light();
    userOverride = userOverride !== null ? !userOverride : !gradeResult?.correct;
  }

  function skipWord() {
    if (isGrading || showingAnswer || !currentReview) return;
    haptics.light();
    typedAnswer = '';
    gradeResult = { correct: false, score: 0 };
  }

  // Undo last submitted card
  function undoLast() {
    if (undoStack.length === 0 || showingAnswer) return;
    haptics.warning();
    const last = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    sessionResults = sessionResults.slice(0, -1);
    reviewDirection = 'back';
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
    <ReviewHeader
      {sessionStarted}
      {isFinished}
      currentIndex={currentReviewIndex}
      totalCount={dueReviews.length}
      {canUndo}
      bind:showKeyboardHelp
      onundo={undoLast}
    />

    <KeyboardShortcutsModal
      bind:show={showKeyboardHelp}
      onclose={() => (showKeyboardHelp = false)}
    />

    {#if hasNoReviews}
      <NoReviewsCard />
    {:else if !sessionStarted}
      <SessionStartCard
        reviewCount={dueReviews.length}
        onstart={() => {
          sessionStarted = true;
          reviewCardStartMs = Date.now();
        }}
      />
    {:else if isFinished}
      <SessionSummary {sessionResults} />
    {:else if currentReview}
      <ReviewCard
        review={currentReview}
        currentIndex={currentReviewIndex}
        totalCount={dueReviews.length}
        bind:typedAnswer
        {showingAnswer}
        {effectiveCorrect}
        {isGrading}
        {isSubmitting}
        {activeLangName}
        {reviewCopied}
        direction={reviewDirection}
        oncopyword={copyReviewWord}
        onshowanswer={showAnswer}
        onskip={skipWord}
        ontoggleoverride={toggleOverride}
        onsubmitnext={submitAndNext}
      />
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
</style>
