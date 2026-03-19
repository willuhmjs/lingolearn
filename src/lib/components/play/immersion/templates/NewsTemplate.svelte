<script lang="ts">
  import TokenizedText from '../TokenizedText.svelte';

  let {
    data,
    onWordClick
  }: {
    data: any;
    onWordClick: (e: MouseEvent | KeyboardEvent, rawWord: string) => void;
  } = $props();
</script>

<div class="template news-template">
  <div class="news-source-bar">
    <span class="news-source">{data.source}</span>
    <span class="news-date">{data.date}</span>
  </div>
  <h1 class="news-headline">
    <TokenizedText text={data.headline || ''} {onWordClick} />
  </h1>
  <p class="news-byline">
    <TokenizedText text={data.byline || ''} {onWordClick} />
  </p>
  <hr class="news-rule" />
  <p class="news-lead">
    <TokenizedText text={data.lead || ''} {onWordClick} />
  </p>
  <p class="news-body">
    <TokenizedText text={data.body || ''} {onWordClick} />
  </p>
</div>

<style>
  .template {
    padding: 1.5rem;
  }

  .news-source-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.78rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .news-headline {
    font-size: 1.6rem;
    font-weight: 900;
    line-height: 1.2;
    color: #0f172a;
    margin: 0 0 0.5rem;
    font-family: Georgia, 'Times New Roman', serif;
  }

  :global(html[data-theme='dark']) .news-headline {
    color: #f1f5f9;
  }

  .news-byline {
    font-size: 0.85rem;
    color: #64748b;
    font-style: italic;
    margin: 0 0 0.75rem;
  }

  .news-rule {
    border: none;
    border-top: 2px solid #0f172a;
    margin: 0.75rem 0;
  }

  :global(html[data-theme='dark']) .news-rule {
    border-color: #f1f5f9;
  }

  .news-lead {
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.65;
    color: #1e293b;
    margin: 0 0 1rem;
    font-family: Georgia, serif;
  }

  :global(html[data-theme='dark']) .news-lead {
    color: #e2e8f0;
  }

  .news-body {
    font-size: 0.97rem;
    line-height: 1.75;
    color: #334155;
    margin: 0;
    font-family: Georgia, serif;
    white-space: pre-line;
  }

  :global(html[data-theme='dark']) .news-body {
    color: #cbd5e1;
  }
</style>
