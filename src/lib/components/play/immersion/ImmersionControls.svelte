<script lang="ts">
  import { fly } from 'svelte/transition';

  type MediaType =
    | 'news_article'
    | 'advertisement'
    | 'restaurant_menu'
    | 'social_post'
    | 'recipe'
    | 'review'
    | 'letter';

  type ImmersionSession = {
    mediaType: MediaType;
    templateData: Record<string, any>;
    questions: any[];
    vocabIds: string[];
    destination: any | null;
  };

  type Bookmark = {
    id: string;
    savedAt: string;
    mediaType: MediaType;
    mediaLabel: string;
    headline: string;
    session: ImmersionSession;
  };

  let {
    selectedMediaType = $bindable('random'),
    loading,
    session,
    isBookmarked,
    bookmarks,
    showBookmarks = $bindable(false),
    MEDIA_TYPES,
    MEDIA_LABELS,
    language,
    onGenerate,
    onToggleBookmark,
    onLoadBookmark,
    onDeleteBookmark
  }: {
    selectedMediaType: MediaType | 'random';
    loading: boolean;
    session: ImmersionSession | null;
    isBookmarked: boolean;
    bookmarks: Bookmark[];
    showBookmarks: boolean;
    MEDIA_TYPES: Array<MediaType | 'random'>;
    MEDIA_LABELS: Record<MediaType, { label: string; icon: string }>;
    language: any;
    onGenerate: () => void;
    onToggleBookmark: () => void;
    onLoadBookmark: (bm: Bookmark) => void;
    onDeleteBookmark: (id: string) => void;
  } = $props();
</script>

<div class="controls-card" in:fly={{ y: 16, duration: 300 }}>
  <div class="controls-header">
    <div>
      <h2 class="controls-title">Immerse</h2>
      <p class="controls-desc">
        Read authentic {language?.name || 'target language'} content, then answer comprehension questions.
      </p>
    </div>
    {#if language?.flag}
      <span class="lang-flag">{language.flag}</span>
    {/if}
  </div>

  <div class="type-selector">
    <span class="selector-label">Content type:</span>
    <div class="type-pills" role="group" aria-label="Select content type">
      {#each MEDIA_TYPES as type}
        <button
          class="type-pill"
          class:active={selectedMediaType === type}
          aria-pressed={selectedMediaType === type}
          onclick={() => (selectedMediaType = type)}
          disabled={loading}
        >
          {type === 'random'
            ? '🎲 Random'
            : MEDIA_LABELS[type].icon + ' ' + MEDIA_LABELS[type].label}
        </button>
      {/each}
    </div>
  </div>

  <div class="generate-row">
    <button class="generate-btn" onclick={onGenerate} disabled={loading}>
      {#if loading}
        <span class="spinner"></span>
        Generating...
      {:else if session}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="width:1.1rem;height:1.1rem;flex-shrink:0;"
        >
          <path
            d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          />
        </svg>
        Generate New
      {:else}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="width:1.1rem;height:1.1rem;flex-shrink:0;"
        >
          <path
            d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          />
        </svg>
        Generate Content
      {/if}
    </button>

    <!-- Bookmark actions -->
    <div class="bookmark-actions">
      {#if session}
        <button
          class="bookmark-btn"
          class:bookmarked={isBookmarked}
          onclick={onToggleBookmark}
          title={isBookmarked ? 'Remove bookmark' : 'Save this content'}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this content'}
          disabled={loading}
        >
          <svg
            viewBox="0 0 24 24"
            fill={isBookmarked ? 'currentColor' : 'none'}
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
            width="18"
            height="18"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      {/if}
      {#if bookmarks.length > 0}
        <button
          class="bookmark-list-btn"
          onclick={() => (showBookmarks = !showBookmarks)}
          title="Saved content"
          disabled={loading}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
            width="16"
            height="16"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {bookmarks.length}
        </button>
      {/if}
    </div>
  </div>

  <!-- Bookmarks panel -->
  {#if showBookmarks}
    <div class="bookmarks-panel" in:fly={{ y: -8, duration: 200 }}>
      <p class="bookmarks-panel-title">Saved Content</p>
      <ul class="bookmarks-list">
        {#each bookmarks as bm}
          <li class="bookmark-item">
            <button class="bookmark-load-btn" onclick={() => onLoadBookmark(bm)}>
              <span class="bookmark-icon">{MEDIA_LABELS[bm.mediaType]?.icon ?? '📄'}</span>
              <span class="bookmark-headline">{bm.headline}</span>
              <span class="bookmark-type">{bm.mediaLabel}</span>
            </button>
            <button
              class="bookmark-delete-btn"
              onclick={() => onDeleteBookmark(bm.id)}
              aria-label="Delete bookmark"
              title="Remove"
            >
              &times;
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .controls-card {
    background: var(--card-bg, #fff);
    border: 1.5px solid var(--card-border, #e2e8f0);
    border-radius: 1.25rem;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  :global(html[data-theme='dark']) .controls-card {
    background: #1e293b;
    border-color: #334155;
  }

  .controls-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .controls-title {
    font-size: 1.3rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.2rem;
  }

  :global(html[data-theme='dark']) .controls-title {
    color: #f1f5f9;
  }

  .controls-desc {
    font-size: 0.9rem;
    color: #64748b;
    margin: 0;
  }

  .lang-flag {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .selector-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    margin-bottom: 0.5rem;
    display: block;
  }

  .type-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .type-pill {
    padding: 0.35rem 0.85rem;
    border-radius: 2rem;
    border: 1.5px solid var(--card-border, #e2e8f0);
    background: transparent;
    font-size: 0.82rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }

  .type-pill:hover {
    border-color: #1cb0f6;
    color: #1cb0f6;
  }

  .type-pill.active {
    background: #1cb0f6;
    border-color: #1cb0f6;
    color: #fff;
  }

  :global(html[data-theme='dark']) .type-pill {
    border-color: #334155;
    color: #94a3b8;
  }

  :global(html[data-theme='dark']) .type-pill.active {
    background: #1cb0f6;
    color: #fff;
  }

  .generate-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .bookmark-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .bookmark-btn {
    background: none;
    border: 2px solid var(--card-border, #e2e8f0);
    border-radius: 0.6rem;
    padding: 0.55rem;
    cursor: pointer;
    color: #94a3b8;
    display: flex;
    align-items: center;
    transition: all 0.15s;
    line-height: 0;
  }

  :global(html[data-theme='dark']) .bookmark-btn {
    border-color: #334155;
  }

  .bookmark-btn:hover {
    color: #fbbf24;
    border-color: #fbbf24;
  }

  .bookmark-btn.bookmarked {
    color: #fbbf24;
    border-color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .bookmark-list-btn {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--card-bg, #fff);
    border: 2px solid var(--card-border, #e2e8f0);
    border-radius: 0.6rem;
    padding: 0.45rem 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    transition: all 0.15s;
  }

  :global(html[data-theme='dark']) .bookmark-list-btn {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
  }

  .bookmark-list-btn:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  :global(html[data-theme='dark']) .bookmark-list-btn:hover {
    background: #334155;
    color: #f1f5f9;
  }

  .bookmarks-panel {
    background: #f8fafc;
    border: 1px solid var(--card-border, #e2e8f0);
    border-radius: 0.75rem;
    padding: 0.75rem;
    margin-top: 0.5rem;
  }

  :global(html[data-theme='dark']) .bookmarks-panel {
    background: #0f172a;
    border-color: #334155;
  }

  .bookmarks-panel-title {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #94a3b8;
    margin: 0 0 0.5rem;
  }

  .bookmarks-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .bookmark-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .bookmark-load-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e2e8f0);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    min-width: 0;
    font-family: inherit;
  }

  :global(html[data-theme='dark']) .bookmark-load-btn {
    background: #1e293b;
    border-color: #334155;
  }

  .bookmark-load-btn:hover {
    background: #f1f5f9;
  }

  :global(html[data-theme='dark']) .bookmark-load-btn:hover {
    background: #334155;
  }

  .bookmark-icon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .bookmark-headline {
    flex: 1;
    font-size: 0.85rem;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(html[data-theme='dark']) .bookmark-headline {
    color: #e2e8f0;
  }

  .bookmark-type {
    font-size: 0.65rem;
    font-weight: 700;
    color: #94a3b8;
    flex-shrink: 0;
  }

  .bookmark-delete-btn {
    background: none;
    border: none;
    color: #94a3b8;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem 0.4rem;
    border-radius: 0.35rem;
    line-height: 1;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .bookmark-delete-btn:hover {
    color: #f87171;
    background: #fee2e2;
  }

  :global(html[data-theme='dark']) .bookmark-delete-btn:hover {
    background: rgba(248, 113, 113, 0.1);
  }

  .generate-btn {
    padding: 0.8rem 1.5rem;
    background: #7c3aed;
    color: #fff;
    border: none;
    border-radius: 0.75rem;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    justify-content: center;
    transition: all 0.15s;
    box-shadow: 0 4px 0 #5b21b6;
  }

  .generate-btn:hover:not(:disabled) {
    background: #6d28d9;
    transform: translateY(-1px);
  }

  .generate-btn:disabled {
    opacity: 0.6;
    cursor: default;
    transform: none;
    box-shadow: 0 2px 0 #5b21b6;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
