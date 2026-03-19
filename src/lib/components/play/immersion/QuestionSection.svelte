<script lang="ts">
  import { fly } from 'svelte/transition';

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
    vocabIds: string[];
    destination: any | null;
  };

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

  /* eslint-disable svelte/no-unused-props */
  let {
    session,
    answers = $bindable({}),
    onMcqSelect,
    onSubmitFreeResponse,
    getScoreClass
  }: {
    session: ImmersionSession;
    answers: Record<string, AnswerState>;
    onMcqSelect: (questionId: string, optionIndex: number, question: Question) => void;
    onSubmitFreeResponse: (question: Question) => void;
    getScoreClass: (score: number) => string;
  } = $props();

  const progressCount = $derived(
    session.questions.filter((q) => {
      const s = answers[q.id] || {};
      return s.mcqSubmitted || s.frSubmitted;
    }).length
  );

  const progressPct = $derived(
    session.questions.length > 0 ? (progressCount / session.questions.length) * 100 : 0
  );
</script>

<div class="questions-section">
  <div class="questions-header">
    <h3 class="questions-title">Comprehension Questions</h3>
    <span class="questions-progress">{progressCount} / {session.questions.length}</span>
  </div>
  <div class="questions-progress-bar">
    <div class="questions-progress-fill" style="width: {progressPct}%"></div>
  </div>
  <p class="questions-subtitle">Answer in English based on what you read.</p>

  {#each session.questions as question, i}
    {@const state = answers[question.id] || {}}
    <div class="question-card" in:fly={{ y: 16, duration: 300, delay: i * 80 }}>
      <div class="question-header">
        <span class="question-num">Q{i + 1}</span>
        <span
          class="question-badge {question.type === 'multiple_choice' ? 'badge-mcq' : 'badge-fr'}"
        >
          {question.type === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}
        </span>
        <span class="question-points">{question.points} pts</span>
      </div>
      <p class="question-text">{question.question}</p>

      {#if question.type === 'multiple_choice'}
        <div class="mcq-options">
          {#each question.options || [] as option, idx}
            <button
              class="mcq-option"
              class:selected={state.selectedOption === idx && !state.mcqSubmitted}
              class:correct={state.mcqSubmitted && idx === question.correctIndex}
              class:incorrect={state.mcqSubmitted &&
                state.selectedOption === idx &&
                idx !== question.correctIndex}
              class:dimmed={state.mcqSubmitted &&
                idx !== question.correctIndex &&
                state.selectedOption !== idx}
              disabled={state.mcqSubmitted}
              onclick={() => onMcqSelect(question.id, idx, question)}
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
          oninput={() => {
            answers[question.id] = state;
            // No need to trigger reactivity here if we bind:value and update state in object
          }}
        ></textarea>
        {#if !state.frSubmitted}
          <button
            class="fr-submit-btn"
            disabled={!state.frText?.trim() || state.frSubmitting}
            onclick={() => onSubmitFreeResponse(question)}
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
                <span class="xp-badge"
                  >+{Math.round(question.points * (state.frScore ?? 0))} XP</span
                >
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

<style>
  .questions-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1.5rem;
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
    position: relative;
    overflow: hidden;
  }

  .questions-progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 50%,
      transparent 100%
    );
    animation: progress-shimmer 1.6s ease-in-out infinite;
    transform: translateX(-100%);
  }

  @keyframes progress-shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(200%);
    }
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
    background: rgba(28, 176, 246, 0.1);
  }

  .mcq-option.selected {
    border-color: #1cb0f6;
    background: #ddf4ff;
  }

  :global(html[data-theme='dark']) .mcq-option.selected {
    background: rgba(28, 176, 246, 0.2);
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

  .xp-badge {
    background: #fbbf24;
    color: #0f172a;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 0.1rem 0.5rem;
    border-radius: 2rem;
    margin-left: 0.25rem;
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

  .fr-feedback {
    font-size: 0.85rem;
    color: #475569;
    margin: 0;
    line-height: 1.5;
  }

  :global(html[data-theme='dark']) .fr-feedback {
    color: #94a3b8;
  }

  .sample-answer-details summary {
    cursor: pointer;
    color: #64748b;
    font-weight: 600;
    padding: 0.25rem 0;
    font-size: 0.85rem;
  }

  .sample-answer-details p {
    margin: 0.5rem 0 0;
    color: #475569;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border-radius: 0.5rem;
    font-size: 0.85rem;
  }

  :global(html[data-theme='dark']) .sample-answer-details p {
    background: #0f172a;
    color: #94a3b8;
  }
</style>
