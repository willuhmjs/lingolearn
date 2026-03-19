<script lang="ts">
  import TokenizedText from '../TokenizedText.svelte';

  let {
    data
  }: {
    data: any;
  } = $props();

  function starRating(n: number) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }
</script>

<div class="template review-template">
  <div class="review-header">
    <div>
      <h2 class="review-subject">{data.subject}</h2>
      <p class="review-stars">{starRating(data.rating ?? 0)}</p>
    </div>
    <div class="review-meta">
      <span class="review-author">{data.author}</span>
      <span class="review-date">{data.date}</span>
    </div>
  </div>
  <p class="review-body">
    <TokenizedText text={data.body || ''} />
  </p>
  <div class="review-verdict">
    <strong>Fazit:</strong>
    <TokenizedText text={data.verdict || ''} />
  </div>
</div>

<style>
  .template {
    padding: 1.5rem;
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .review-subject {
    font-size: 1.3rem;
    font-weight: 800;
    margin: 0 0 0.25rem;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .review-subject {
    color: #f1f5f9;
  }

  .review-stars {
    font-size: 1.2rem;
    color: #fbbf24;
    margin: 0;
  }

  .review-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
    font-size: 0.82rem;
    color: #64748b;
  }

  .review-author {
    font-weight: 600;
    color: #475569;
  }

  :global(html[data-theme='dark']) .review-author {
    color: #94a3b8;
  }

  .review-body {
    font-size: 0.95rem;
    line-height: 1.75;
    color: #334155;
    white-space: pre-line;
    margin: 0 0 1rem;
  }

  :global(html[data-theme='dark']) .review-body {
    color: #cbd5e1;
  }

  .review-verdict {
    background: #f8fafc;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    color: #475569;
    border-left: 3px solid #1cb0f6;
  }

  :global(html[data-theme='dark']) .review-verdict {
    background: #0f172a;
    color: #94a3b8;
  }
</style>
