<script lang="ts">
  import { fly } from 'svelte/transition';

  let {
    sessionStarted,
    isFinished,
    currentIndex,
    totalCount,
    canUndo,
    showKeyboardHelp = $bindable(),
    onundo
  }: {
    sessionStarted: boolean;
    isFinished: boolean;
    currentIndex: number;
    totalCount: number;
    canUndo: boolean;
    showKeyboardHelp: boolean;
    onundo: () => void;
  } = $props();
</script>

<header class="page-header review-header" in:fly={{ y: 20, duration: 400 }}>
  <h1>Vocabulary Review</h1>
  <div class="review-header-right">
    {#if sessionStarted && !isFinished && totalCount > 0}
      <span class="review-counter">
        {currentIndex + 1} / {totalCount}
      </span>
    {/if}
    {#if sessionStarted && !isFinished}
      <button class="btn-undo" onclick={onundo} disabled={!canUndo} title="Undo last card (Ctrl+Z)">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 14L4 9l5-5" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 9h11a5 5 0 010 10h-1" />
        </svg>
        Undo
        <span class="undo-kbd-hint">Ctrl+Z</span>
      </button>
    {/if}
    <button
      class="btn-kbd-help"
      onclick={() => (showKeyboardHelp = !showKeyboardHelp)}
      title="Keyboard shortcuts"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
      </svg>
    </button>
  </div>
</header>

<style>
  .review-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
  }

  .review-header h1 {
    font-size: 2rem;
    margin: 0;
    color: var(--text-color, #0f172a);
  }

  .review-header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .review-counter {
    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
    color: #1e40af;
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    font-weight: 800;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  :global(html[data-theme='dark']) .review-counter {
    background: linear-gradient(135deg, rgba(30, 58, 138, 0.3) 0%, rgba(30, 58, 138, 0.5) 100%);
    color: #bfdbfe;
    box-shadow: none;
  }

  .btn-undo {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: 2px solid #e2e8f0;
    color: #64748b;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 0.4rem 0.75rem;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-undo svg {
    width: 1rem;
    height: 1rem;
  }

  .btn-undo:hover {
    border-color: #94a3b8;
    color: #334155;
    background: #f8fafc;
  }

  :global(html[data-theme='dark']) .btn-undo {
    border-color: #3a4150;
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .btn-undo:hover {
    border-color: #64748b;
    color: #cbd5e1;
    background: #2a303c;
  }

  .btn-undo:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-undo:disabled:hover {
    border-color: #e2e8f0;
    color: #64748b;
    background: none;
  }

  :global(html[data-theme='dark']) .btn-undo:disabled:hover {
    border-color: #3a4150;
    color: #94a3b8;
    background: none;
  }

  .undo-kbd-hint {
    font-size: 0.6rem;
    font-weight: 700;
    background: rgba(0, 0, 0, 0.07);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.25rem;
    padding: 0.1rem 0.35rem;
    color: #94a3b8;
    letter-spacing: 0.02em;
  }

  :global(html[data-theme='dark']) .undo-kbd-hint {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .btn-kbd-help {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 2px solid #e2e8f0;
    color: #64748b;
    padding: 0.4rem;
    border-radius: 0.75rem;
    cursor: pointer;
    transition: all 0.15s;
    width: 2.5rem;
    height: 2.5rem;
  }

  .btn-kbd-help svg {
    width: 1.2rem;
    height: 1.2rem;
  }

  .btn-kbd-help:hover {
    border-color: #94a3b8;
    color: #334155;
    background: #f8fafc;
  }

  :global(html[data-theme='dark']) .btn-kbd-help {
    border-color: #3a4150;
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .btn-kbd-help:hover {
    border-color: #64748b;
    color: #cbd5e1;
    background: #2a303c;
  }
</style>
