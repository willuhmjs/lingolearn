<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let currentQuestionIndex = $state(0);
  let score = $state(0);
  let isQuizOver = $state(false);
  let selectedOption: string | null = $state(null);
  let isAnswerCorrect: boolean | null = $state(null);
  let showResult = $state(false);

  let game = $derived(data.game);
  let questions = $derived(game.questions || []);
  let currentQuestion = $derived(questions[currentQuestionIndex]);

  // Assignment context
  let assignment = $derived(data.assignment ?? null);
  let assignmentScore = $derived(data.assignmentScore);
  let assignmentProgress: { score: number; targetScore: number; passed: boolean } | null =
    $state(null);
  $effect(() => {
    assignmentProgress = assignmentScore
      ? {
          score: assignmentScore.score,
          targetScore: assignment?.targetScore ?? 0,
          passed: assignmentScore.passed
        }
      : assignment
        ? { score: 0, targetScore: assignment.targetScore, passed: false }
        : null;
  });

  let options = $state<string[]>([]);

  $effect(() => {
    if (currentQuestion) {
      const rawOptions = Array.isArray(currentQuestion.options)
        ? currentQuestion.options
        : typeof currentQuestion.options === 'string'
          ? JSON.parse(currentQuestion.options)
          : [];

      const opts = [...rawOptions].filter((opt: string) => opt !== currentQuestion.answer);
      opts.push(currentQuestion.answer);

      for (let i = opts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      options = opts;
    }
  });

  async function selectOption(option: string) {
    if (showResult) return;

    selectedOption = option;
    isAnswerCorrect = option === currentQuestion.answer;
    if (isAnswerCorrect) {
      score++;
    }
    showResult = true;

    // Report to assignment if in assignment context
    if (assignment) {
      try {
        const res = await fetch('/api/quiz-assignment-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: assignment.id,
            isCorrect: isAnswerCorrect
          })
        });
        if (res.ok) {
          const result = await res.json();
          assignmentProgress = result.assignmentProgress;
        }
      } catch (_) {
        // non-critical
      }
    }
  }

  function nextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
      currentQuestionIndex++;
      selectedOption = null;
      isAnswerCorrect = null;
      showResult = false;
    } else {
      isQuizOver = true;
    }
  }

  let isChallengeSent = $state(false);
  let challengeError = $state<string | null>(null);

  async function challengeFriend(friendId: string) {
    challengeError = null;
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          challengeeId: friendId,
          scoreToBeat: score
        })
      });
      if (res.ok) {
        isChallengeSent = true;
      } else {
        const err = await res.json();
        challengeError = err.error || 'Failed to send challenge';
      }
    } catch {
      challengeError = 'An error occurred';
    }
  }
</script>

<div class="learn-container">
  <nav class="breadcrumb">
    <a href="/play?tab=games">Quizzes</a>
    <span class="breadcrumb-sep">/</span>
    <span class="breadcrumb-current">{game.title}</span>
  </nav>

  {#if assignment && assignmentProgress}
    <div class="assignment-banner {assignmentProgress.passed ? 'passed' : 'active'}">
      <div class="assignment-info">
        <span class="assignment-label">📋 {assignment.title}</span>
        <span class="assignment-class">{assignment.class?.name ?? 'Class'}</span>
      </div>
      <div class="assignment-progress">
        <span class="progress-value {assignmentProgress.passed ? 'passed' : ''}">
          {assignmentProgress.score}<span class="progress-target"
            >/{assignmentProgress.targetScore}</span
          >
        </span>
        {#if assignmentProgress.passed}
          <span class="passed-badge">✓ Passed</span>
        {/if}
      </div>
    </div>
  {/if}

  {#if isQuizOver}
    <div class="card-duo game-over-card">
      <h1>Quiz Complete!</h1>
      <p class="score-text">
        Your Score: {score} / {questions.length}
      </p>
      {#if assignmentProgress?.passed}
        <p class="passed-text">🏆 Assignment passed!</p>
      {/if}

      {#if data.friends && data.friends.length > 0}
        <div class="challenge-section">
          <h3>Challenge a Friend</h3>
          {#if isChallengeSent}
            <p class="text-success">Challenge sent!</p>
          {:else}
            <div class="friend-challenge-list">
              {#each data.friends as friend}
                <button
                  class="btn-secondary challenge-btn"
                  onclick={() => challengeFriend(friend.id)}
                >
                  Challenge {friend.username}
                </button>
              {/each}
            </div>
            {#if challengeError}
              <p class="text-error">{challengeError}</p>
            {/if}
          {/if}
        </div>
      {/if}

      <div class="game-over-actions">
        {#if assignment}
          <a href="/classes/{assignment.classId}" class="btn-primary link-btn-primary"
            >Back to Class</a
          >
        {:else}
          <a href="/play?tab=games" class="btn-primary link-btn-primary">Return to Quizzes</a>
        {/if}
      </div>
    </div>
  {:else if currentQuestion}
    <div class="game-header">
      <h1>{game.title}</h1>
      <div class="progress-badge">Question {currentQuestionIndex + 1} of {questions.length}</div>
    </div>
    <div class="quiz-progress-bar">
      <div
        class="quiz-progress-fill"
        style="width: {(currentQuestionIndex / questions.length) * 100}%"
      ></div>
    </div>

    <div class="card-duo question-card">
      <h2 class="question-text">{currentQuestion.question}</h2>

      <div class="options-grid">
        {#each options as option, i}
          <button
            class="option-btn {showResult && option === currentQuestion.answer
              ? 'correct-btn'
              : showResult && option === selectedOption && option !== currentQuestion.answer
                ? 'incorrect-btn'
                : ''}"
            onclick={() => selectOption(option)}
            disabled={showResult}
          >
            {#if !showResult}<span class="option-key-hint">{i + 1}</span>{/if}
            {option}
          </button>
        {/each}
      </div>

      {#if showResult}
        <div class="result-section">
          <div class="result-message">
            {#if isAnswerCorrect}
              <span class="text-success">Correct!</span>
            {:else}
              <span class="text-error">Incorrect!</span> The correct answer is {currentQuestion.answer}.
            {/if}
          </div>
          <button class="btn-primary next-btn" onclick={nextQuestion}>
            {currentQuestionIndex === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="card-duo empty-card">
      <h1>No questions available for this quiz.</h1>
      <a href="/play?tab=games" class="btn-primary link-btn-primary mt-4">Return to Quizzes</a>
    </div>
  {/if}
</div>

<style>
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .breadcrumb a {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 600;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .breadcrumb-sep {
    color: #9ca3af;
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  :global(html[data-theme='dark']) .breadcrumb-current {
    color: #9ca3af;
  }

  .assignment-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    border-radius: 1rem;
    margin-bottom: 1.25rem;
    border: 2px solid #bfdbfe;
    background: #eff6ff;
    font-weight: 700;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .assignment-banner.passed {
    background: #f0fdf4;
    border-color: #86efac;
  }

  :global(html[data-theme='dark']) .assignment-banner {
    background: #1e3a5f;
    border-color: #3b82f6;
  }

  :global(html[data-theme='dark']) .assignment-banner.passed {
    background: #14532d;
    border-color: #22c55e;
  }

  .assignment-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .assignment-label {
    font-size: 0.9rem;
    color: var(--text-color, #1e293b);
  }

  .assignment-class {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 600;
  }

  .assignment-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .progress-value {
    font-size: 1.25rem;
    font-weight: 900;
    color: #3b82f6;
  }

  .progress-value.passed {
    color: #16a34a;
  }

  .progress-target {
    font-size: 0.85rem;
    font-weight: 700;
    color: #94a3b8;
  }

  .passed-badge {
    font-size: 0.75rem;
    font-weight: 800;
    background: #dcfce7;
    color: #16a34a;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
  }

  .learn-container {
    max-width: 42rem;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .card-duo {
    padding: 2rem;
    text-align: center;
  }

  .game-over-card h1 {
    font-size: 2.5rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 1rem;
  }

  .score-text {
    font-size: 1.5rem;
    color: #475569;
    margin: 0 0 1rem;
  }

  .passed-text {
    font-size: 1.1rem;
    font-weight: 700;
    color: #16a34a;
    margin: 0 0 1.5rem;
  }

  .link-btn-primary {
    display: inline-block;
    text-decoration: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: bold;
  }

  .mt-4 {
    margin-top: 1rem;
  }

  .game-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .game-header h1 {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.5rem;
  }

  .progress-badge {
    display: inline-block;
    background-color: #f1f5f9;
    color: #475569;
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: bold;
  }

  .quiz-progress-bar {
    height: 5px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .quiz-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #1cb0f6, #7c3aed);
    border-radius: 999px;
    transition: width 0.4s ease;
  }

  :global(html[data-theme='dark']) .quiz-progress-bar {
    background: #334155;
  }

  .question-card {
    padding: 1.5rem;
  }

  @media (min-width: 640px) {
    .question-card {
      padding: 2rem;
    }
  }

  .question-text {
    font-size: 1.25rem;
    font-weight: bold;
    margin: 0 0 1.5rem;
    color: var(--text-color, #1e293b);
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .options-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .option-btn {
    min-height: 4rem;
    padding: 1rem;
    font-size: 1.125rem;
    border-radius: 0.75rem;
    background-color: white;
    border: 2px solid #cbd5e1;
    color: #334155;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 0 #cbd5e1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .option-key-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    font-size: 0.7rem;
    font-weight: 800;
    background: #e2e8f0;
    color: #64748b;
    border-radius: 0.3rem;
    flex-shrink: 0;
  }

  :global(html[data-theme='dark']) .option-key-hint {
    background: #334155;
    color: #94a3b8;
  }

  .option-btn:not(:disabled):hover {
    border-color: #3b82f6;
    color: #1d4ed8;
    transform: translateY(-2px);
    box-shadow: 0 4px 0 #3b82f6;
  }

  .option-btn:not(:disabled):active {
    transform: translateY(0);
    box-shadow: 0 2px 0 #3b82f6;
  }

  .option-btn:disabled {
    cursor: default;
  }

  .correct-btn {
    background-color: #dcfce7 !important;
    border-color: #22c55e !important;
    color: #15803d !important;
    box-shadow: 0 2px 0 #16a34a !important;
  }

  .incorrect-btn {
    background-color: #fee2e2 !important;
    border-color: #ef4444 !important;
    color: #b91c1c !important;
    box-shadow: 0 2px 0 #dc2626 !important;
  }

  .result-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px dashed #e2e8f0;
  }

  .result-message {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 1rem;
    color: #334155;
  }

  .text-success {
    color: #16a34a;
  }

  .text-error {
    color: #dc2626;
  }

  .next-btn {
    padding: 0.75rem 2rem;
    border-radius: 0.75rem;
    font-size: 1.125rem;
    font-weight: bold;
  }

  .empty-card h1 {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--text-color, #1e293b);
    margin: 0 0 1rem;
  }

  /* Dark mode */
  :global(html[data-theme='dark']) .option-btn {
    background-color: #2a303c;
    border-color: #3a4150;
    color: #cbd5e1;
    box-shadow: 0 2px 0 #3a4150;
  }

  :global(html[data-theme='dark']) .option-btn:not(:disabled):hover {
    border-color: #60a5fa;
    color: #93c5fd;
    box-shadow: 0 4px 0 #3b82f6;
  }

  :global(html[data-theme='dark']) .correct-btn {
    background-color: rgba(20, 83, 45, 0.3) !important;
    border-color: #4ade80 !important;
    color: #4ade80 !important;
    box-shadow: 0 2px 0 rgba(20, 83, 45, 0.5) !important;
  }

  :global(html[data-theme='dark']) .incorrect-btn {
    background-color: rgba(127, 29, 29, 0.3) !important;
    border-color: #f87171 !important;
    color: #f87171 !important;
    box-shadow: 0 2px 0 rgba(127, 29, 29, 0.5) !important;
  }

  :global(html[data-theme='dark']) .result-section {
    border-top-color: #3a4150;
  }

  :global(html[data-theme='dark']) .result-message {
    color: #cbd5e1;
  }
  .game-over-actions {
    margin-top: 1.5rem;
    display: flex;
    justify-content: center;
    gap: 1rem;
  }

  .challenge-section {
    margin: 2rem 0;
    padding: 1.5rem;
    background: #f8fafc;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
  }

  :global(html[data-theme='dark']) .challenge-section {
    background: #1e293b;
    border-color: #334155;
  }

  .challenge-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.125rem;
  }

  .friend-challenge-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
  }

  .challenge-btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  }

  .text-success {
    color: #16a34a;
    font-weight: 600;
  }

  .text-error {
    color: #dc2626;
    font-size: 0.875rem;
  }
</style>
