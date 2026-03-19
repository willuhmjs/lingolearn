<script lang="ts">
  let {
    show,
    review
  }: {
    show: boolean;
    review: any;
  } = $props();
</script>

{#if show}
  <div class="srs-panel" role="status">
    <div class="srs-panel-row">
      <span class="srs-panel-label">State</span>
      <span class="srs-panel-val srs-state-{(review.srsState || 'UNSEEN').toLowerCase()}"
        >{review.srsState || 'Unseen'}</span
      >
    </div>
    <div class="srs-panel-row">
      <span class="srs-panel-label">Memory stability</span>
      <span class="srs-panel-val"
        >{review.stability != null && review.stability > 0
          ? '~' + Math.round(review.stability) + ' days'
          : 'New card'}</span
      >
    </div>
    <div class="srs-panel-row">
      <span class="srs-panel-label">Memory strength</span>
      <span class="srs-panel-val"
        >{review.retrievability != null
          ? Math.round(review.retrievability * 100) + '%'
          : '\u2014'}</span
      >
    </div>
    <div class="srs-panel-row">
      <span class="srs-panel-label">Times reviewed</span>
      <span class="srs-panel-val">{review.repetitions ?? 0}</span>
    </div>
    <div class="srs-panel-row">
      <span class="srs-panel-label">Mistakes</span>
      <span class="srs-panel-val">{review.lapses ?? 0}</span>
    </div>
    <div class="srs-panel-row">
      <span class="srs-panel-label">Next due</span>
      <span class="srs-panel-val"
        >{review.nextReviewDate ? new Date(review.nextReviewDate).toLocaleDateString() : '—'}</span
      >
    </div>
  </div>
{/if}

<style>
  .srs-panel {
    margin-top: 0.75rem;
    background: var(--card-bg, #f8fafc);
    border: 1.5px solid var(--card-border, #e2e8f0);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem 1rem;
    font-size: 0.82rem;
    width: 100%;
  }

  :global(html[data-theme='dark']) .srs-panel {
    background: #1a2230;
    border-color: #334155;
  }

  .srs-panel-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .srs-panel-label {
    color: #94a3b8;
    font-weight: 600;
  }

  .srs-panel-val {
    font-weight: 700;
    color: var(--text-color, #1e293b);
  }

  .srs-state-unseen {
    color: #64748b;
  }

  .srs-state-learning {
    color: #d97706;
  }

  .srs-state-known {
    color: #059669;
  }

  .srs-state-mastered {
    color: #047857;
  }
</style>
