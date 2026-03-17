<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import EloProgressBar from '$lib/components/play/EloProgressBar.svelte';

  let {
    feedback,
    challenge,
    parsedTargetSentence,
    showAfterElo,
    genderToArticle,
    onNextChallenge
  }: {
    feedback: any;
    challenge: any;
    parsedTargetSentence: string;
    showAfterElo: boolean;
    genderToArticle: (gender: string | null | undefined, lang?: string) => string | null;
    onNextChallenge: () => void;
  } = $props();
</script>

<div class="card card-duo feedback-card" in:fly={{ y: 20, duration: 400 }}>
  <div class="feedback-header">
    <h2>Feedback</h2>
    <div class="score-display">
      <span class="score-label">Score:</span>
      {#if feedback.globalScore === null}
        <div class="score-spinner"></div>
      {:else}
        <span
          class="score-value"
          class:excellent={feedback.globalScore > 0.8}
          class:good={feedback.globalScore <= 0.8 && feedback.globalScore > 0.5}
          class:needs-work={feedback.globalScore <= 0.5}
        >
          {Math.round(feedback.globalScore * 100)}%
        </span>
      {/if}
    </div>
  </div>

  <div class="feedback-message">
    <p>
      {feedback.feedback}
    </p>
  </div>

  <div class="feedback-section">
    <h3>Expected Answer:</h3>
    <div class="expected-answer">
      <p>{@html parsedTargetSentence}</p>
    </div>
  </div>

  <div class="feedback-grid">
    {#if feedback.vocabularyUpdates?.length > 0}
      <div class="feedback-list-section">
        <h3>Vocabulary Used</h3>
        <ul>
          {#each feedback.vocabularyUpdates as update}
            {@const v = challenge.targetedVocabulary.find((v: any) => v.id === update.id)}
            <li>
              <span class="icon" in:scale={{ delay: 200, duration: 400, start: 0.5 }}>
                {(update.score ?? 0) >= 0.5 ? '✅' : '❌'}
              </span>
              <div class="item-info">
                <div class="item-row">
                  <span class="item-label">
                    {#if v}
                      {[genderToArticle(v.gender), v.lemma].filter(Boolean).join('\u00A0') +
                        (v.plural ? '\u00A0(pl: ' + v.plural + ')' : '')}
                    {:else}
                      {update.id}
                    {/if}
                  </span>
                  <span class="elo-display">
                    ELO {Math.round(
                      showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
                    )}
                    {#if showAfterElo && update.eloAfter !== update.eloBefore}
                      {@const delta = Math.round(update.eloAfter - update.eloBefore)}
                      <span
                        class="elo-delta"
                        class:positive={delta > 0}
                        class:negative={delta < 0}
                        in:fly={{ y: 5, delay: 600 }}
                      >
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    {/if}
                  </span>
                </div>
                <EloProgressBar
                  eloValue={showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)}
                />
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if feedback.grammarUpdates?.length > 0}
      <div class="feedback-list-section">
        <h3>Grammar Rules Followed</h3>
        <ul>
          {#each feedback.grammarUpdates as update}
            <li>
              <span class="icon" in:scale={{ delay: 200, duration: 400, start: 0.5 }}>
                {(update.score ?? 0) >= 0.5 ? '✅' : '❌'}
              </span>
              <div class="item-info">
                <div class="item-row">
                  <span class="item-label">
                    {challenge.targetedGrammar.find((g: any) => g.id === update.id)?.title ||
                      update.id}
                  </span>
                  <span class="elo-display">
                    ELO {Math.round(
                      showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)
                    )}
                    {#if showAfterElo && update.eloAfter !== update.eloBefore}
                      {@const delta = Math.round(update.eloAfter - update.eloBefore)}
                      <span
                        class="elo-delta"
                        class:positive={delta > 0}
                        class:negative={delta < 0}
                        in:fly={{ y: 5, delay: 600 }}
                      >
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    {/if}
                  </span>
                </div>
                <EloProgressBar
                  eloValue={showAfterElo ? (update.eloAfter ?? 1000) : (update.eloBefore ?? 1000)}
                />
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <button
    onclick={onNextChallenge}
    class="btn-duo btn-ai next-btn"
    style="margin-top: 1.5rem; width: 100%;"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="width:1.25rem;height:1.25rem;flex-shrink:0;margin-right:0.5rem;"
      ><path
        d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
      /></svg
    >
    Next Challenge
  </button>
</div>

<style>
  .feedback-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .feedback-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .feedback-header h2 {
    color: #f1f5f9;
  }

  .score-display {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .score-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
  }

  :global(html[data-theme='dark']) .score-label {
    color: #94a3b8;
  }

  .score-value {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .score-value.excellent {
    color: #16a34a;
  }
  .score-value.good {
    color: #ca8a04;
  }
  .score-value.needs-work {
    color: #dc2626;
  }

  .score-spinner {
    display: inline-block;
    width: 1.2rem;
    height: 1.2rem;
    border: 3px solid #e2e8f0;
    border-top-color: #7c3aed;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .feedback-message {
    background-color: #eff6ff;
    border-left: 4px solid #3b82f6;
    padding: 1rem;
    border-radius: 0 8px 8px 0;
    margin-bottom: 1.5rem;
    color: #1e3a8a;
    line-height: 1.5;
  }

  :global(html[data-theme='dark']) .feedback-message {
    background-color: #0c1a3a;
    color: #93c5fd;
  }

  .feedback-message p {
    margin: 0;
  }

  .feedback-section h3,
  .feedback-list-section h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.5rem 0;
  }

  :global(html[data-theme='dark']) .feedback-section h3,
  :global(html[data-theme='dark']) .feedback-list-section h3 {
    color: #94a3b8;
  }

  .expected-answer {
    background-color: #f0fdf4;
    border: 1px solid #bbf7d0;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  :global(html[data-theme='dark']) .expected-answer {
    background-color: #0d1f14;
    border-color: #166534;
  }

  .expected-answer p {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
    color: #166534;
  }

  :global(html[data-theme='dark']) .expected-answer p {
    color: #86efac;
  }

  .feedback-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  @media (min-width: 640px) {
    .feedback-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .feedback-list-section ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .feedback-list-section li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1rem;
    color: #334155;
    font-size: 0.95rem;
  }

  :global(html[data-theme='dark']) .feedback-list-section li {
    color: #cbd5e1;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }

  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .elo-display {
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
    background: #f1f5f9;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    white-space: nowrap;
  }

  :global(html[data-theme='dark']) .elo-display {
    background: #2a303c;
    color: #94a3b8;
  }

  .elo-delta {
    font-size: 0.75rem;
    font-weight: 800;
    margin-left: 0.25rem;
  }

  .elo-delta.positive {
    color: #16a34a;
  }
  .elo-delta.negative {
    color: #dc2626;
  }

  .feedback-list-section .icon {
    flex-shrink: 0;
  }

  .next-btn {
    width: 100%;
    margin-top: 1rem;
  }

  @media (max-width: 768px) {
    .feedback-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
  }
</style>
