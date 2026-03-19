<script lang="ts">
  type Token = { word: true; value: string } | { word: false; value: string };

  let {
    text = '',
    onWordClick
  }: {
    text: string;
    onWordClick: (e: MouseEvent | KeyboardEvent, rawWord: string) => void;
  } = $props();

  function tokenize(text: string): Token[] {
    if (!text) return [];
    const parts = text.split(/(\s+)/);
    return parts.map((p) =>
      /^\s+$/.test(p) ? { word: false, value: p } : { word: true, value: p }
    );
  }

  const tokens = $derived(tokenize(text));
</script>

{#each tokens as tok}
  {#if tok.word}
    <span
      class="w-tok"
      role="button"
      tabindex="0"
      aria-label="Look up {tok.value}"
      onclick={(e) => onWordClick(e, tok.value)}
      onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onWordClick(e, tok.value)}
    >
      {tok.value}
    </span>
  {:else}
    {tok.value}
  {/if}
{/each}

<style>
  .w-tok {
    cursor: pointer;
    border-bottom: 1px dashed rgba(28, 176, 246, 0.3);
    border-radius: 0.25rem;
    transition: all 0.15s;
    padding: 0 1px;
    margin: 0 -1px;
    display: inline-block;
  }

  .w-tok:hover {
    background: rgba(28, 176, 246, 0.1);
    border-bottom-color: #1cb0f6;
    color: #1cb0f6;
  }

  :global(.no-word-hover) .w-tok {
    cursor: text;
    border-bottom: none;
    pointer-events: none;
  }
</style>
