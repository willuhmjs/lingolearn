<script lang="ts">
  interface UrgentItem {
    vocabularyId: string;
    retrievabilityPct: number;
    lapses: number;
    lemma: string;
    meaning: string | null;
  }

  interface GrammarCoverage {
    total: number;
    interacted: number;
    mastered: number;
    locked: number;
    available: number;
  }

  interface Props {
    urgentItems: UrgentItem[];
    errorTypeCounts: Record<string, number>;
    totalOverrides: number;
    grammarCoverage: GrammarCoverage | null;
  }

  let { urgentItems, errorTypeCounts, totalOverrides, grammarCoverage }: Props = $props();

  const errorLabels: Record<string, string> = {
    wrong_case: 'Wrong Case',
    wrong_tense: 'Wrong Tense',
    wrong_gender: 'Wrong Gender',
    spelling: 'Spelling',
    word_order: 'Word Order',
    vocabulary_gap: 'Vocabulary Gap'
  };
</script>

{#if urgentItems.length > 0 || Object.keys(errorTypeCounts).length > 0}
  <section class="insights-section">
    <h2>Learning Insights</h2>
    <div class="insights-grid">
      {#if urgentItems.length > 0}
        <div class="insight-card urgent-card">
          <h3>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="16"
              height="16"
              aria-hidden="true"
              ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              /></svg
            >
            Fading Fast
          </h3>
          <p class="insight-desc">Words your memory of has dropped below 70% — review them soon.</p>
          <ul class="urgent-list">
            {#each urgentItems as item}
              <li class="urgent-row">
                <span class="urgent-lemma">{item.lemma}</span>
                {#if item.meaning}<span class="urgent-meaning">{item.meaning}</span>{/if}
                <span
                  class="urgent-ret"
                  style="color: {item.retrievabilityPct < 40
                    ? '#ef4444'
                    : item.retrievabilityPct < 60
                      ? '#f97316'
                      : '#eab308'}">{item.retrievabilityPct}%</span
                >
                {#if item.lapses > 0}<span class="urgent-lapses"
                    >{item.lapses} lapse{item.lapses !== 1 ? 's' : ''}</span
                  >{/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if Object.keys(errorTypeCounts).length > 0}
        {@const totalErrors = Object.values(errorTypeCounts).reduce(
          (a, b) => (a as number) + (b as number),
          0
        ) as number}
        <div class="insight-card error-card">
          <h3>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="16"
              height="16"
              aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg
            >
            Error Breakdown
          </h3>
          <p class="insight-desc">Types of mistakes in your most recent answers.</p>
          <div class="error-bars">
            {#each Object.entries(errorTypeCounts).sort((a, b) => (b[1] as number) - (a[1] as number)) as [type, count]}
              <div class="error-bar-row">
                <span class="error-label">{errorLabels[type] ?? type}</span>
                <div class="error-track">
                  <div
                    class="error-fill"
                    style="width:{Math.round(((count as number) / totalErrors) * 100)}%"
                  ></div>
                </div>
                <span class="error-count">{count as number}</span>
              </div>
            {/each}
          </div>
          {#if totalOverrides > 0}
            <p class="override-note">
              {totalOverrides} self-correction{totalOverrides !== 1 ? 's' : ''} recorded
            </p>
          {/if}
        </div>
      {/if}

      {#if grammarCoverage}
        {@const coverage = grammarCoverage}
        <div class="insight-card coverage-card">
          <h3>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              width="16"
              height="16"
              aria-hidden="true"
              ><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path
                d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
              /></svg
            >
            Grammar Coverage
          </h3>
          <p class="insight-desc">{coverage.total} total rules in this language.</p>
          <div class="coverage-rows">
            <div class="coverage-row">
              <span class="coverage-dot" style="background:#10b981"></span>
              <span class="coverage-label">Mastered / Known</span>
              <span class="coverage-val">{coverage.mastered}</span>
            </div>
            <div class="coverage-row">
              <span class="coverage-dot" style="background:#fef08a;border:1px solid #ca8a04"></span>
              <span class="coverage-label">Interacted</span>
              <span class="coverage-val">{coverage.interacted - coverage.mastered}</span>
            </div>
            <div class="coverage-row">
              <span class="coverage-dot" style="background:#e2e8f0;border:1px solid #94a3b8"></span>
              <span class="coverage-label">Available to Learn</span>
              <span class="coverage-val">{coverage.available}</span>
            </div>
            <div class="coverage-row">
              <span class="coverage-dot" style="background:#94a3b8"></span>
              <span class="coverage-label">Locked (prereqs unmet)</span>
              <span class="coverage-val">{coverage.locked}</span>
            </div>
          </div>
          <div class="coverage-bar-track">
            <div
              class="coverage-seg mastered-seg"
              style="width:{Math.round((coverage.mastered / coverage.total) * 100)}%"
            ></div>
            <div
              class="coverage-seg learning-seg"
              style="width:{Math.round(
                ((coverage.interacted - coverage.mastered) / coverage.total) * 100
              )}%"
            ></div>
            <div
              class="coverage-seg available-seg"
              style="width:{Math.round((coverage.available / coverage.total) * 100)}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  </section>
{/if}

<style>
  .insights-section {
    margin-bottom: 2.5rem;
  }
  .insights-section h2 {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-color);
    margin: 0 0 1rem;
  }
  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
  .insight-card {
    background: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e2e8f0);
    border-radius: var(--radius-xl, 1rem);
    box-shadow: var(--shadow-duo);
    padding: 1.25rem;
  }
  .insight-card h3 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.35rem;
  }
  .insight-desc {
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
    margin: 0 0 0.85rem;
  }

  /* Urgent fading words */
  .urgent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .urgent-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }
  .urgent-lemma {
    font-weight: 700;
    color: var(--text-color, #1e293b);
    min-width: 80px;
  }
  .urgent-meaning {
    color: var(--text-muted, #64748b);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.8rem;
  }
  .urgent-ret {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .urgent-lapses {
    font-size: 0.75rem;
    color: #ef4444;
    white-space: nowrap;
  }

  /* Error bars */
  .error-bars {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  .error-bar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  .error-label {
    width: 110px;
    color: var(--text-color, #475569);
    flex-shrink: 0;
  }
  .error-track {
    flex: 1;
    height: 0.5rem;
    background: var(--card-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
  }
  .error-fill {
    height: 100%;
    background: #f97316;
    border-radius: 9999px;
    transition: width 0.3s;
  }
  .error-count {
    font-family: ui-monospace, monospace;
    font-size: 0.8rem;
    color: var(--text-muted, #64748b);
    width: 24px;
    text-align: right;
  }
  .override-note {
    margin: 0.75rem 0 0;
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
    font-style: italic;
  }

  /* Grammar coverage */
  .coverage-rows {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 0.85rem;
  }
  .coverage-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.82rem;
  }
  .coverage-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .coverage-label {
    flex: 1;
    color: var(--text-color, #475569);
  }
  .coverage-val {
    font-family: ui-monospace, monospace;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-color, #1e293b);
  }
  .coverage-bar-track {
    display: flex;
    height: 0.6rem;
    border-radius: 9999px;
    overflow: hidden;
    background: var(--card-border, #e2e8f0);
  }
  .coverage-seg {
    height: 100%;
    transition: width 0.3s;
  }
  .mastered-seg {
    background: #10b981;
  }
  .learning-seg {
    background: #fef08a;
    border-top: 1px solid #ca8a04;
    border-bottom: 1px solid #ca8a04;
  }
  .available-seg {
    background: #cbd5e1;
  }
</style>
