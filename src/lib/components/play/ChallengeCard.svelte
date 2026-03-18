<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { marked } from 'marked';
  import CefrBadge from '$lib/components/CefrBadge.svelte';
  import FillInBlankView from '$lib/components/play/FillInBlankView.svelte';
  import MultipleChoiceView from '$lib/components/play/MultipleChoiceView.svelte';
  import TranslationView from '$lib/components/play/TranslationView.svelte';

  let {
    challenge,
    feedback,
    submitting,
    loading,
    isStreaming,
    parsedChallengeText,
    sentenceTooComplex,
    sentenceEstimatedLevel,
    displayedChallengeNumber,
    lessonLanguage,
    fillBlankAnswers = $bindable<string[]>([]),
    selectedChoice = $bindable<string | null>(null),
    shuffledChoices,
    hasSubmittedMc,
    userInput = $bindable(''),
    showGrammarRef = $bindable(false),
    expandedGrammarId = $bindable<string | null>(null),
    onChangeMode,
    onSubmitAnswer,
    onToggleGrammar
  }: {
    challenge: any;
    feedback: any;
    submitting: boolean;
    loading: boolean;
    isStreaming: boolean;
    parsedChallengeText: string;
    sentenceTooComplex: boolean;
    sentenceEstimatedLevel: string | null;
    displayedChallengeNumber: number;
    lessonLanguage: any;
    fillBlankAnswers: string[];
    selectedChoice: string | null;
    shuffledChoices: string[];
    hasSubmittedMc: boolean;
    userInput: string;
    showGrammarRef: boolean;
    expandedGrammarId: string | null;
    onChangeMode: () => void;
    onSubmitAnswer: () => void;
    onToggleGrammar: (id: string) => void;
  } = $props();

  const hoverScale = spring(1, {
    stiffness: 0.1,
    damping: 0.25
  });
  const grammarHoverScale = spring(1, { stiffness: 0.1, damping: 0.25 });
</script>

<div class="card card-duo challenge-card" in:fly={{ y: 20, duration: 400 }}>
  <div class="challenge-card-top">
    <button
      type="button"
      class="change-mode-link"
      onclick={onChangeMode}
      onmouseenter={() => hoverScale.set(1.02)}
      onmouseleave={() => hoverScale.set(1)}
      style="transform: scale({$hoverScale})"
    >
      &larr; Change Mode
    </button>
    <div class="challenge-badges">
      {#if sentenceEstimatedLevel}
        <CefrBadge level={sentenceEstimatedLevel} />
      {/if}
      <span class="session-progress-badge" in:fade={{ delay: 200 }}
        >Challenge {displayedChallengeNumber}</span
      >
    </div>
  </div>
  {#if sentenceTooComplex}
    <div
      class="difficulty-notice"
      title="This sentence uses advanced structures — a good stretch!"
      in:fly={{ x: -10, duration: 400 }}
    >
      ⚡ Advanced structure
    </div>
  {/if}
  <div class="challenge-section">
    {#if challenge.gameMode === 'fill-blank'}
      <h3 in:fade>Fill in the blanks:</h3>
    {:else if challenge.gameMode === 'multiple-choice'}
      <h3 in:fade>Choose the correct English translation:</h3>
    {:else if challenge.gameMode === 'target-to-native'}
      <h3 in:fade>Translate this to English:</h3>
    {:else}
      <h3 in:fade>
        Translate this to {lessonLanguage?.name || 'Target'}:
      </h3>
    {/if}
    <p class="challenge-text">{@html parsedChallengeText}</p>
  </div>

  {#if challenge.gameMode === 'fill-blank' && challenge.hints?.length > 0}
    <div class="challenge-section">
      <h3>Hints:</h3>
      <ul class="hint-list">
        {#each challenge.hints as hint, i}
          <li>
            <span class="hint-number">Blank {i + 1}:</span>
            {hint.hint}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="challenge-section grammar-ref-section">
    {#if isStreaming}
      <div class="ai-magic-loader">
        <span class="sparkle">✨</span>
        <span class="italic">AI is analyzing grammar & generating tooltips...</span>
      </div>
    {:else}
      <button
        type="button"
        class="grammar-ref-toggle"
        onclick={() => (showGrammarRef = !showGrammarRef)}
        onmouseenter={() => grammarHoverScale.set(1.02)}
        onmouseleave={() => grammarHoverScale.set(1)}
        style="transform: scale({$grammarHoverScale})"
      >
        {showGrammarRef ? 'Hide help' : 'Need help?'}
        <span class="grammar-ref-chevron" class:expanded={showGrammarRef}>&#9662;</span>
      </button>
      {#if showGrammarRef}
        <div transition:fly={{ y: -10, duration: 300, opacity: 0 }}>
          <h3 style="margin-top: 0.75rem;">Grammar Reference:</h3>
          {#if challenge.targetedGrammar?.length > 0}
            <ul class="concept-list">
              {#each challenge.targetedGrammar as grammar, i}
                <li class="grammar-item" in:fly={{ y: 10, delay: i * 100 }}>
                  <div class="grammar-header">
                    <span class="concept-type">Grammar</span>
                    <span class="grammar-title">{grammar.title}</span>
                    {#if grammar.guide}
                      <button
                        type="button"
                        class="guide-toggle-btn"
                        onclick={() => onToggleGrammar(grammar.id)}
                      >
                        {expandedGrammarId === grammar.id ? 'Hide Guide' : 'Show Guide'}
                      </button>
                    {/if}
                  </div>
                  {#if grammar.guide && expandedGrammarId === grammar.id}
                    <div
                      class="grammar-guide markdown-body"
                      transition:fly={{ y: -5, duration: 250 }}
                    >
                      {@html marked(grammar.guide)}
                    </div>
                  {/if}
                </li>
              {/each}
            </ul>
          {:else}
            <p class="italic">None found</p>
          {/if}
        </div>
      {/if}
    {/if}
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      onSubmitAnswer();
    }}
    class="answer-form"
  >
    {#if challenge.gameMode === 'fill-blank'}
      <FillInBlankView
        {challenge}
        {submitting}
        {feedback}
        {loading}
        bind:fillBlankAnswers
        {lessonLanguage}
      />
    {:else if challenge.gameMode === 'multiple-choice'}
      <MultipleChoiceView
        {challenge}
        {submitting}
        {feedback}
        {loading}
        {shuffledChoices}
        bind:selectedChoice
        {hasSubmittedMc}
        submitAnswer={onSubmitAnswer}
      />
    {:else}
      <TranslationView
        {challenge}
        {submitting}
        {feedback}
        {loading}
        bind:userInput
        {lessonLanguage}
        onsubmit={onSubmitAnswer}
      />
    {/if}

    {#if !feedback}
      {#if challenge.gameMode !== 'multiple-choice'}
        <button
          type="submit"
          disabled={submitting ||
            !challenge?.targetSentence ||
            (challenge.gameMode === 'fill-blank'
              ? fillBlankAnswers.length === 0 || fillBlankAnswers.some((a: string) => !a.trim())
              : challenge.gameMode === 'multiple-choice'
                ? !selectedChoice
                : !userInput.trim())}
          class="btn-duo btn-primary submit-btn"
          style="margin-top: 1.5rem; width: 100%;"
        >
          {submitting ? 'Evaluating...' : 'Submit Answer'}
        </button>
      {/if}
    {/if}
  </form>
</div>

<style>
  .challenge-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .challenge-badges {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .session-progress-badge {
    font-size: 0.78rem;
    font-weight: 700;
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    color: #1e40af;
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
  }

  :global(html[data-theme='dark']) .session-progress-badge {
    background: rgba(30, 58, 138, 0.35);
    color: #bfdbfe;
  }

  .difficulty-notice {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #92400e;
    background: #fef3c7;
    border: 1px solid #fcd34d;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    margin-bottom: 0.5rem;
    cursor: default;
  }
  :global(html[data-theme='dark']) .difficulty-notice {
    background: rgba(120, 53, 15, 0.3);
    color: #fcd34d;
    border-color: rgba(252, 211, 77, 0.3);
  }

  .change-mode-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    font-size: 0.85rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0;
    transition: color 0.15s;
  }

  .change-mode-link:hover {
    color: #3b82f6;
  }

  :global(html[data-theme='dark']) .change-mode-link {
    color: #94a3b8;
  }

  .challenge-section {
    margin-bottom: 1.5rem;
  }

  .challenge-section h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.5rem 0;
  }

  :global(html[data-theme='dark']) .challenge-section h3 {
    color: #94a3b8;
  }

  .challenge-text {
    font-size: 1.5rem;
    font-weight: 500;
    color: #0f172a;
    margin: 0;
  }

  :global(html[data-theme='dark']) .challenge-text {
    color: var(--text-color, #e2e8f0);
  }

  .ai-magic-loader {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .grammar-ref-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.4rem 0.75rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
  }

  .grammar-ref-toggle:hover {
    color: #3b82f6;
    border-color: #93c5fd;
    background: #eff6ff;
  }

  :global(html[data-theme='dark']) .grammar-ref-toggle {
    color: #94a3b8;
    border-color: #3a4150;
  }

  :global(html[data-theme='dark']) .grammar-ref-toggle:hover {
    color: #60a5fa;
    border-color: #3b82f6;
    background: #2a303c;
  }

  .grammar-ref-chevron {
    display: inline-block;
    transition: transform 0.2s;
    font-size: 0.75rem;
  }

  .grammar-ref-chevron.expanded {
    transform: rotate(180deg);
  }

  .concept-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .concept-list li {
    color: #475569;
    margin-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  :global(html[data-theme='dark']) .concept-list li {
    color: #cbd5e1;
  }

  .grammar-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .grammar-title {
    font-weight: 500;
  }

  :global(html[data-theme='dark']) .grammar-title {
    color: #e2e8f0;
  }

  .guide-toggle-btn {
    background: none;
    border: none;
    font-size: 0.8rem;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    margin-left: auto;
  }

  :global(html[data-theme='dark']) .guide-toggle-btn {
    color: #60a5fa;
  }

  .concept-type {
    background: #e2e8f0;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
  }

  :global(html[data-theme='dark']) .concept-type {
    background: #3a4150;
    color: #cbd5e1;
  }

  .grammar-guide {
    padding: 1.25rem;
    border-radius: 0.75rem;
    font-size: 1rem;
    line-height: 1.6;
    overflow-x: auto;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #334155;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
  }

  :global(html[data-theme='dark']) .grammar-guide {
    background: #0f172a;
    border-color: #1e293b;
    color: #cbd5e1;
  }

  .grammar-guide :global(h1),
  .grammar-guide :global(h2),
  .grammar-guide :global(h3),
  .grammar-guide :global(h4) {
    color: #0f172a;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: 700;
    line-height: 1.3;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(h1),
  :global(html[data-theme='dark']) .grammar-guide :global(h2),
  :global(html[data-theme='dark']) .grammar-guide :global(h3),
  :global(html[data-theme='dark']) .grammar-guide :global(h4) {
    color: #f8fafc;
  }

  .grammar-guide :global(h1:first-child),
  .grammar-guide :global(h2:first-child),
  .grammar-guide :global(h3:first-child) {
    margin-top: 0;
  }

  .grammar-guide :global(h1) {
    font-size: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.5rem;
  }
  .grammar-guide :global(h2) {
    font-size: 1.25rem;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 0.3rem;
  }
  .grammar-guide :global(h3) {
    font-size: 1.1rem;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(h1),
  :global(html[data-theme='dark']) .grammar-guide :global(h2) {
    border-color: #1e293b;
  }

  .grammar-guide :global(p) {
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .grammar-guide :global(p:last-child) {
    margin-bottom: 0;
  }

  .grammar-guide :global(ul),
  .grammar-guide :global(ol) {
    margin-top: 0;
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  .grammar-guide :global(li) {
    margin-bottom: 0.25rem;
  }

  .grammar-guide :global(strong),
  .grammar-guide :global(b) {
    font-weight: 700;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(strong),
  :global(html[data-theme='dark']) .grammar-guide :global(b) {
    color: #f8fafc;
  }

  .grammar-guide :global(em),
  .grammar-guide :global(i) {
    color: #475569;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(em),
  :global(html[data-theme='dark']) .grammar-guide :global(i) {
    color: #94a3b8;
  }

  .grammar-guide :global(code) {
    background: #e2e8f0;
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85em;
    color: #db2777;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(code) {
    background: #1e293b;
    color: #f472b6;
  }

  .grammar-guide :global(pre) {
    background: #1e293b;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  .grammar-guide :global(pre code) {
    background: transparent;
    color: #e2e8f0;
    padding: 0;
    font-size: 0.9em;
  }

  .grammar-guide :global(blockquote) {
    border-left: 4px solid #3b82f6;
    padding-left: 1rem;
    margin-left: 0;
    margin-right: 0;
    background: #f1f5f9;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    border-radius: 0 0.25rem 0.25rem 0;
    font-style: italic;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(blockquote) {
    background: #1e293b;
    border-left-color: #60a5fa;
  }

  .grammar-guide :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
  }

  .grammar-guide :global(th),
  .grammar-guide :global(td) {
    border: 1px solid #e2e8f0;
    padding: 0.5rem;
    text-align: left;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(th),
  :global(html[data-theme='dark']) .grammar-guide :global(td) {
    border-color: #334155;
  }

  .grammar-guide :global(th) {
    background: #f1f5f9;
    font-weight: 600;
  }

  :global(html[data-theme='dark']) .grammar-guide :global(th) {
    background: #1e293b;
  }

  .hint-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hint-list li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #475569;
    font-size: 0.95rem;
    background: #f8fafc;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  :global(html[data-theme='dark']) .hint-list li {
    color: #cbd5e1;
    background: #2a303c;
  }

  .hint-number {
    font-weight: 600;
    color: #2563eb;
    white-space: nowrap;
  }

  .answer-form {
    margin-top: 2rem;
  }

  .submit-btn {
    width: 100%;
  }

  @media (max-width: 768px) {
    .btn-duo {
      width: 100%;
      box-sizing: border-box;
    }
  }
</style>
