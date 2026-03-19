<script lang="ts">
  let {
    wordPopup,
    wordAddedSet,
    wordAddingId,
    closeWordPopup,
    addWordToVocabulary
  }: {
    wordPopup: {
      word: string;
      x: number;
      y: number;
      loading: boolean;
      result: any | null;
      error: string;
    };
    wordAddedSet: Set<string>;
    wordAddingId: string | null;
    closeWordPopup: () => void;
    addWordToVocabulary: (vocabularyId: string) => void;
  } = $props();
</script>

<div
  class="word-popup"
  role="dialog"
  aria-label="Word lookup"
  tabindex="-1"
  style="left:{wordPopup.x}px;top:{wordPopup.y}px"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <div class="word-popup-header">
    <span class="word-popup-word">{wordPopup.word}</span>
    <button class="word-popup-close" onclick={closeWordPopup} aria-label="Close">×</button>
  </div>
  {#if wordPopup.loading}
    <div class="word-popup-loading">
      <span class="spinner"></span>
      Looking up...
    </div>
  {:else if wordPopup.result}
    {@const r = wordPopup.result}
    <div class="word-popup-lemma">
      {r.lemma}{r.gender === 'MASCULINE'
        ? ' (der)'
        : r.gender === 'FEMININE'
          ? ' (die)'
          : r.gender === 'NEUTER'
            ? ' (das)'
            : ''}
    </div>
    {#each (r.meanings || []).slice(0, 3) as m}
      <div class="word-popup-meaning">
        {#if m.partOfSpeech}<span class="word-popup-pos">{m.partOfSpeech}</span>{/if}
        {m.value}
      </div>
    {/each}
    {#if r.id}
      <div class="word-popup-actions">
        {#if wordAddedSet.has(r.id)}
          <span class="word-popup-added">✓ Added</span>
        {:else}
          <button
            class="word-popup-add-btn"
            onclick={() => addWordToVocabulary(r.id)}
            disabled={wordAddingId === r.id}
            >{wordAddingId === r.id ? 'Adding...' : '+ Add to vocabulary'}</button
          >
        {/if}
      </div>
    {/if}
  {:else if wordPopup.error}
    <div class="word-popup-error">{wordPopup.error}</div>
  {/if}
</div>

<style>
  .word-popup {
    position: fixed;
    z-index: 200;
    background: #fff;
    border: 1.5px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    min-width: 200px;
    max-width: 280px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  :global(html[data-theme='dark']) .word-popup {
    background: #1e293b;
    border-color: #475569;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .word-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .word-popup-word {
    font-size: 1rem;
    font-weight: 800;
    color: #0f172a;
  }

  :global(html[data-theme='dark']) .word-popup-word {
    color: #f1f5f9;
  }

  .word-popup-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    line-height: 1;
    color: #94a3b8;
    cursor: pointer;
    padding: 0 0.2rem;
    flex-shrink: 0;
  }

  .word-popup-close:hover {
    color: #475569;
  }

  .word-popup-lemma {
    font-size: 0.82rem;
    font-weight: 600;
    color: #7c3aed;
  }

  :global(html[data-theme='dark']) .word-popup-lemma {
    color: #a78bfa;
  }

  .word-popup-meaning {
    font-size: 0.88rem;
    color: #334155;
    line-height: 1.4;
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
  }

  :global(html[data-theme='dark']) .word-popup-meaning {
    color: #cbd5e1;
  }

  .word-popup-pos {
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 0.05rem 0.35rem;
    border-radius: 0.25rem;
    flex-shrink: 0;
  }

  :global(html[data-theme='dark']) .word-popup-pos {
    background: #0f172a;
    color: #64748b;
  }

  .word-popup-loading {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #64748b;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(100, 116, 139, 0.2);
    border-top-color: #64748b;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .word-popup-error {
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .word-popup-actions {
    margin-top: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px solid #e2e8f0;
  }

  :global(html[data-theme='dark']) .word-popup-actions {
    border-color: #334155;
  }

  .word-popup-add-btn {
    width: 100%;
    background: #1cb0f6;
    border: none;
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .word-popup-add-btn:hover:not(:disabled) {
    background: #0ea5e9;
  }

  .word-popup-add-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .word-popup-added {
    display: block;
    text-align: center;
    font-size: 0.78rem;
    font-weight: 700;
    color: #16a34a;
  }

  :global(html[data-theme='dark']) .word-popup-added {
    color: #4ade80;
  }
</style>
