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

<div class="template letter-template">
  <div class="letter-location-date">
    {data.location}, {data.date}
  </div>
  <p class="letter-salutation">
    <TokenizedText text={data.salutation || ''} {onWordClick} />
  </p>
  <p class="letter-body">
    <TokenizedText text={data.body || ''} {onWordClick} />
  </p>
  <p class="letter-closing">
    <TokenizedText text={data.closing || ''} {onWordClick} />
  </p>
  <p class="letter-signature">{data.signature}</p>
</div>

<style>
  .template {
    padding: 1.5rem;
  }

  .letter-template {
    font-family: Georgia, serif;
    max-width: 520px;
  }

  .letter-location-date {
    text-align: right;
    color: #64748b;
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }

  .letter-salutation {
    font-weight: 700;
    margin: 0 0 0.75rem;
    color: #1e293b;
  }

  :global(html[data-theme='dark']) .letter-salutation {
    color: #e2e8f0;
  }

  .letter-body {
    font-size: 0.97rem;
    line-height: 1.85;
    color: #334155;
    white-space: pre-line;
    margin: 0 0 1.25rem;
  }

  :global(html[data-theme='dark']) .letter-body {
    color: #cbd5e1;
  }

  .letter-closing {
    margin: 0 0 0.25rem;
    color: #475569;
  }

  .letter-signature {
    font-style: italic;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  :global(html[data-theme='dark']) .letter-signature {
    color: #e2e8f0;
  }
</style>
