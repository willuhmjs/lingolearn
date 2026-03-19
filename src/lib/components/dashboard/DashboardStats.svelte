<script lang="ts">
  import { SRS_COLORS } from '$lib/utils/srsColors';

  const srsColors: Record<string, string> = {
    LOCKED: '#94a3b8',
    ...SRS_COLORS
  };

  interface Props {
    vocabularies: any[];
    grammarRules: any[];
  }

  let { vocabularies, grammarRules }: Props = $props();

  let totalVocab = $derived(vocabularies.length);
  let avgVocabElo = $derived(
    totalVocab > 0
      ? Math.ceil(vocabularies.reduce((acc: number, v: any) => acc + v.eloRating, 0) / totalVocab)
      : 0
  );
  let vocabSrsBreakdown = $derived(
    vocabularies.reduce(
      (acc: Record<string, number>, v: any) => {
        acc[v.srsState] = (acc[v.srsState] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  );

  let totalGrammar = $derived(grammarRules.length);
  let avgGrammarElo = $derived(
    totalGrammar > 0
      ? Math.ceil(grammarRules.reduce((acc: number, r: any) => acc + r.eloRating, 0) / totalGrammar)
      : 0
  );
  let grammarSrsBreakdown = $derived(
    grammarRules.reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.srsState] = (acc[r.srsState] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  );
</script>

<section class="summary-section">
  <h2>Summary Statistics</h2>
  <div class="summary-grid">
    <div class="summary-card">
      <h3>Vocabulary</h3>
      <div class="stat-row">
        <span class="stat-label">Total Terms:</span>
        <span class="stat-value">{totalVocab}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Average ELO:</span>
        <span class="stat-value">{avgVocabElo}</span>
      </div>
      <div class="srs-breakdown">
        <h4>SRS State Breakdown</h4>
        {#each Object.entries(srsColors) as [state, color]}
          <div class="breakdown-row">
            <div class="breakdown-label">
              <span class="color-box" style="background-color: {color}"></span>
              {state}
            </div>
            <span>{vocabSrsBreakdown[state] || 0}</span>
          </div>
        {/each}
      </div>
    </div>
    <div class="summary-card">
      <h3>Grammar</h3>
      <div class="stat-row">
        <span class="stat-label">Total Rules:</span>
        <span class="stat-value">{totalGrammar}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Average ELO:</span>
        <span class="stat-value">{avgGrammarElo}</span>
      </div>
      <div class="srs-breakdown">
        <h4>SRS State Breakdown</h4>
        {#each Object.entries(srsColors) as [state, color]}
          <div class="breakdown-row">
            <div class="breakdown-label">
              <span class="color-box" style="background-color: {color}"></span>
              {state}
            </div>
            <span>{grammarSrsBreakdown[state] || 0}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .summary-section {
    margin-bottom: 3rem;
  }

  h2 {
    font-size: 1.25rem;
    color: var(--text-color);
    margin-bottom: 1rem;
    font-weight: 800;
    letter-spacing: -0.025em;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 768px) {
    .summary-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .summary-card {
    background: var(--card-bg, #ffffff);
    border: 2px solid var(--card-border, #e5e7eb);
    border-radius: var(--radius-xl, 1rem);
    padding: 2rem;
    box-shadow: var(--shadow-duo);
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .summary-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, var(--color-primary), var(--color-ai));
  }

  .summary-card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 8px 10px -6px rgba(0, 0, 0, 0.05);
  }

  .summary-card h3 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--text-color);
    font-size: 1.5rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--card-border);
  }

  .stat-row:last-of-type {
    border-bottom: none;
  }

  .stat-label {
    color: var(--text-muted);
    font-weight: 500;
  }

  .stat-value {
    color: var(--text-color);
    font-weight: 700;
    font-size: 1.25rem;
    background: var(--link-hover-bg);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  .srs-breakdown {
    margin-top: 2rem;
    background: var(--link-hover-bg);
    padding: 1.5rem;
    border-radius: var(--radius-lg);
  }

  .srs-breakdown h4 {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    font-size: 0.95rem;
  }

  .breakdown-row:last-child {
    margin-bottom: 0;
  }

  .breakdown-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-color);
    font-weight: 500;
  }

  .color-box {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 4px;
    display: inline-block;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style>
