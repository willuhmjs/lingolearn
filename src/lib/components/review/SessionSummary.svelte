<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import { elasticOut } from 'svelte/easing';

  type ReviewResult = { lemma: string; correct: boolean; answer: string; correctMeaning: string };

  let { sessionResults, onretry }: { sessionResults: ReviewResult[]; onretry?: () => void } =
    $props();

  let correctCount = $derived(sessionResults.filter((r) => r.correct).length);
  let incorrectCount = $derived(sessionResults.filter((r) => !r.correct).length);
  let accuracyPct = $derived(
    sessionResults.length > 0 ? Math.round((correctCount / sessionResults.length) * 100) : 0
  );
  let missedWords = $derived(sessionResults.filter((r) => !r.correct));
</script>

<div class="card-duo summary-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
  <div
    class="summary-icon"
    class:summary-perfect={accuracyPct === 100}
    class:summary-good={accuracyPct >= 70 && accuracyPct < 100}
    class:summary-ok={accuracyPct < 70}
    in:scale={{ duration: 600, delay: 200, easing: elasticOut }}
  >
    {#if accuracyPct === 100}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    {:else}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
        <polyline points="2 17 12 22 22 17"></polyline>
        <polyline points="2 12 12 17 22 12"></polyline>
      </svg>
    {/if}
  </div>
  <h2>
    {accuracyPct === 100
      ? 'Perfect session!'
      : accuracyPct >= 70
        ? 'Great work!'
        : 'Session complete'}
  </h2>
  <p>
    You reviewed <strong>{sessionResults.length}</strong>
    {sessionResults.length === 1 ? 'card' : 'cards'}.
  </p>

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

  {#if missedWords.length > 0}
    <div class="action-btns">
      {#if onretry}
        <button class="btn-duo btn-primary retry-btn" onclick={onretry}>Retry missed words</button>
      {:else}
        <a href="/review" class="btn-duo btn-primary retry-btn">Retry missed words</a>
      {/if}
      <a href="/dashboard" class="btn-duo btn-secondary back-btn">Back to Dashboard</a>
    </div>
  {:else}
    <a href="/dashboard" class="btn-duo btn-primary back-btn">Back to Dashboard</a>
  {/if}
</div>

<style>
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
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.1);
  }

  .summary-icon svg {
    width: 2.75rem;
    height: 2.75rem;
  }

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

  .summary-stat.correct .stat-num {
    color: #16a34a;
  }

  .summary-stat.incorrect .stat-num {
    color: #dc2626;
  }

  .summary-stat.accuracy .stat-num {
    color: #2563eb;
  }

  :global(html[data-theme='dark']) .summary-stat.correct .stat-num {
    color: #4ade80;
  }

  :global(html[data-theme='dark']) .summary-stat.incorrect .stat-num {
    color: #f87171;
  }

  :global(html[data-theme='dark']) .summary-stat.accuracy .stat-num {
    color: #93c5fd;
  }

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

  .missed-item:last-child {
    border-bottom: none;
  }

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

  .action-btns {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .retry-btn,
  .back-btn {
    width: 100%;
    max-width: 260px;
  }
</style>
