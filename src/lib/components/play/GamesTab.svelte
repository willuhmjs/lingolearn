<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import toast from 'svelte-french-toast';
  import { page } from '$app/stores';
  import { getFlagEmoji } from '$lib/utils/playTypes';

  let {
    myGames,
    communityGames,
    totalCommunityGames,
    teacherClasses,
    canPlayLive,
    data
  }: {
    myGames: any[];
    communityGames: any[];
    totalCommunityGames: number;
    teacherClasses: any[];
    canPlayLive: boolean;
    data: any;
  } = $props();

  let currentCategory = $state('All');
  const categories = ['All', 'Vocabulary', 'Grammar', 'Culture', 'Conversation', 'General'];
  let currentPage = $state(1);
  let loadingMore = $state(false);

  // Modal state for selecting a class
  let showClassModal = $state(false);
  let selectedGameIdForLive = $state<string | null>(null);

  async function loadGames(pg = 1, append = false) {
    loadingMore = true;
    try {
      const res = await fetch(`/api/games?page=${pg}&limit=10&category=${currentCategory}`);
      if (res.ok) {
        const json = await res.json();
        if (append) {
          communityGames = [...communityGames, ...json.games];
        } else {
          communityGames = json.games;
        }
        totalCommunityGames = json.pagination.total;
        currentPage = pg;
      }
    } catch (error) {
      console.error('Failed to load games', error);
    } finally {
      loadingMore = false;
    }
  }

  function handleCategoryChange(category: string) {
    currentCategory = category;
    loadGames(1, false);
  }

  function loadMore() {
    loadGames(currentPage + 1, true);
  }

  async function startLiveSession(gameId: string, targetClassId: string) {
    try {
      const res = await fetch(`/api/classes/${targetClassId}/live-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', gameId })
      });
      if (res.ok) {
        toast.success('Live session started! Students can now join.');
        window.location.href = `/classes/${targetClassId}/live/teacher`;
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to start live session');
      }
    } catch (_) {
      toast.error('An error occurred');
    }
  }

  function handlePlayLive(gameId: string) {
    const urlClassId = $page.url.searchParams.get('classId');
    if (urlClassId) {
      startLiveSession(gameId, urlClassId);
      return;
    }

    if (teacherClasses.length === 0) {
      toast.error('You need to create a class first.');
      return;
    }

    if (teacherClasses.length === 1) {
      startLiveSession(gameId, teacherClasses[0].id);
    } else {
      selectedGameIdForLive = gameId;
      showClassModal = true;
    }
  }
</script>

<div class="games-wrapper" in:fly={{ y: 20, duration: 400, delay: 100 }}>
  <div class="header-section">
    <h2>Quiz Library</h2>
    <a href="/play/games/create" class="btn-primary create-btn"> + Create Quiz </a>
  </div>

  <div class="games-section">
    <h2>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
      My Quizzes
    </h2>

    {#if myGames.length === 0}
      <div class="empty-state-rich">
        <div class="empty-state-icon">🎮</div>
        <p class="empty-state-title">No quizzes yet</p>
        <p class="empty-state-desc">
          Create your own vocabulary quiz to practice or share with your class.
        </p>
        <a href="/play/games/create" class="empty-state-btn">Create a Quiz</a>
      </div>
    {:else}
      <div class="games-grid">
        {#each myGames as game}
          <div class="card-duo game-card">
            <div class="game-card-content">
              <div class="game-card-header">
                <h3>{game.title}</h3>
                <span class="language-badge" title={game.language}>
                  {getFlagEmoji(game.language)}
                </span>
              </div>
              <p class="game-description">
                {game.description || 'No description provided.'}
              </p>
              <div class="game-meta">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    /></svg
                  >
                  {game._count.questions} questions
                </span>
                <span>
                  {#if game.isPublished}
                    <span class="status-published"
                      ><span class="status-dot published-dot"></span> Published</span
                    >
                  {:else}
                    <span class="status-draft"
                      ><span class="status-dot draft-dot"></span> Draft</span
                    >
                  {/if}
                </span>
              </div>
            </div>
            <div class="game-actions">
              {#if canPlayLive}
                <button
                  type="button"
                  class="btn-action live-btn"
                  onclick={() => handlePlayLive(game.id)}
                >
                  Play Live
                </button>
              {/if}
              <a href="/play/games/{game.id}/play" class="btn-action"> Solo </a>
              <a href="/play/games/{game.id}/edit" class="btn-action"> Edit </a>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <hr class="games-divider" />

  <div class="games-section community-games-section">
    <h2>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
      Community Quizzes
    </h2>

    <div class="category-pills">
      {#each categories as category}
        <button
          class="filter-pill"
          class:active={currentCategory === category}
          onclick={() => handleCategoryChange(category)}
        >
          {category}
        </button>
      {/each}
    </div>

    {#if communityGames.length === 0}
      <div class="empty-state-rich">
        <div class="empty-state-icon">🌐</div>
        <p class="empty-state-title">No quizzes in this category</p>
        <p class="empty-state-desc">Try a different category, or be the first to create one!</p>
        <a href="/play/games/create" class="empty-state-btn">Create a Quiz</a>
      </div>
    {:else}
      <div class="games-grid">
        {#each data.communityGames as game}
          <div class="card-duo game-card">
            <div class="game-card-content">
              <div class="game-card-header">
                <h3>{game.title}</h3>
                <span class="language-badge" title={game.language}>
                  {getFlagEmoji(game.language)}
                </span>
              </div>
              <p class="game-author">by {game.creator?.username || 'Unknown'}</p>
              <p class="game-description">
                {game.description || 'No description provided.'}
              </p>
              <div class="game-meta" style="justify-content: space-between; align-items: center;">
                <span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    ><path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    /></svg
                  >
                  {(game as { _count?: { questions: number } })._count?.questions || 0} questions
                </span>
                {#if game.category && game.category !== 'General'}
                  <span class="meta-badge">{game.category}</span>
                {/if}
              </div>
            </div>
            <div class="game-actions">
              {#if canPlayLive}
                <button
                  type="button"
                  class="btn-action live-btn"
                  onclick={() => handlePlayLive(game.id)}
                >
                  Play Live
                </button>
              {/if}
              <a href="/play/games/{game.id}/play" class="btn-action"> Solo </a>
            </div>
          </div>
        {/each}
      </div>

      {#if communityGames.length < totalCommunityGames}
        <div class="load-more-container" style="text-align: center; margin-top: 2rem;">
          <button class="btn-load-more" onclick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showClassModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    transition:fade={{ duration: 200 }}
    onclick={() => (showClassModal = false)}
  >
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Select a Class</h2>
        <button class="close-btn" onclick={() => (showClassModal = false)}>×</button>
      </div>
      <div class="modal-body">
        <p class="modal-desc">Which class do you want to start this live session for?</p>
        <div class="class-list">
          {#each teacherClasses as c}
            <button
              class="class-btn"
              onclick={() => {
                showClassModal = false;
                if (selectedGameIdForLive) startLiveSession(selectedGameIdForLive, c.id);
              }}
            >
              {c.name}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .games-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .header-section {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .header-section {
      flex-direction: row;
      align-items: center;
    }
  }

  .header-section h2 {
    font-size: 2rem;
    color: var(--text-color, #0f172a);
    margin: 0;
    font-weight: 800;
  }

  .create-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: bold;
    text-decoration: none;
    display: inline-block;
  }

  .games-section {
    margin-bottom: 1rem;
  }

  .games-section h2 {
    font-size: 1.5rem;
    color: var(--text-color, #1e293b);
    margin: 0 0 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .games-section h2 svg {
    width: 1.5rem;
    height: 1.5rem;
    color: #3b82f6;
  }

  .games-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 640px) {
    .games-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (min-width: 1024px) {
    .games-grid {
      grid-template-columns: 1fr 1fr 1fr;
    }
  }

  .game-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .game-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .game-card-content {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .game-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.25rem;
  }

  .game-card-header h3 {
    font-size: 1.25rem;
    font-weight: bold;
    margin: 0;
    color: var(--text-color, #1e293b);
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    line-clamp: 1;
    overflow: hidden;
  }

  .language-badge {
    background: transparent;
    font-size: 1.5rem;
    line-height: 1;
    cursor: help;
  }

  .game-author {
    font-size: 0.875rem;
    font-weight: bold;
    color: #3b82f6;
    margin: 0;
  }

  .game-description {
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
    flex-grow: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
  }

  .game-meta {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    font-weight: bold;
    color: #64748b;
    margin-top: auto;
  }

  .game-meta span {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .game-meta svg {
    width: 1rem;
    height: 1rem;
  }

  .status-published {
    color: #22c55e;
  }

  .status-draft {
    color: #94a3b8;
  }

  .status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    display: inline-block;
  }

  .published-dot {
    background-color: #22c55e;
  }

  .draft-dot {
    background-color: #94a3b8;
  }

  .game-actions {
    padding: 1rem;
    border-top: 1px solid var(--card-border, #f1f5f9);
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .btn-action {
    flex: 1;
    min-width: calc(50% - 0.75rem);
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: bold;
    padding: 0.5rem 1rem;
    border-radius: 0.75rem;
    border: none;
    text-align: center;
    text-decoration: none;
    transition: background-color 0.2s;
    cursor: pointer;
    font-family: inherit;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .btn-action:hover {
    background: #dbeafe;
  }

  .btn-action.live-btn {
    flex: 1 1 100%;
    background: #f97316;
    color: #ffffff;
  }

  .btn-action.live-btn:hover {
    background: #ea580c;
  }

  :global(html[data-theme='dark']) .btn-action {
    background: #1e3a8a;
    color: #bfdbfe;
  }

  :global(html[data-theme='dark']) .btn-action:hover {
    background: #1e40af;
  }

  :global(html[data-theme='dark']) .btn-action.live-btn {
    background: #ea580c;
    color: #ffffff;
  }

  :global(html[data-theme='dark']) .btn-action.live-btn:hover {
    background: #c2410c;
  }

  .meta-badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    background-color: rgba(255, 255, 255, 0.6);
    color: #475569;
  }

  :global(html[data-theme='dark']) .meta-badge {
    background-color: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }

  /* Empty states */
  .empty-state-rich {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3.5rem 2rem;
    background: var(--card-bg, #f8fafc);
    border: 3px dashed var(--card-border, #cbd5e1);
    border-radius: 1.25rem;
    gap: 0.5rem;
  }

  .empty-state-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .empty-state-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text-color, #1e293b);
    margin: 0;
  }

  .empty-state-desc {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
    max-width: 300px;
  }

  .empty-state-btn {
    display: inline-block;
    margin-top: 0.75rem;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 0.75rem;
    padding: 0.6rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 800;
    box-shadow: 0 3px 0 #2563eb;
    transition: background 0.15s;
  }

  .empty-state-btn:hover {
    background: #2563eb;
  }

  /* Category filter pills */
  .category-pills {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .filter-pill {
    padding: 0.4rem 1rem;
    border-radius: 9999px;
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-pill:hover {
    background: #e2e8f0;
    color: #334155;
  }

  .filter-pill.active {
    background: #dbeafe;
    color: #1d4ed8;
    border-color: #93c5fd;
  }

  :global(html[data-theme='dark']) .filter-pill {
    background: #1e293b;
    color: #94a3b8;
    border-color: #334155;
  }

  :global(html[data-theme='dark']) .filter-pill:hover {
    background: #334155;
    color: #f1f5f9;
  }

  :global(html[data-theme='dark']) .filter-pill.active {
    background: #1e3a8a;
    color: #93c5fd;
    border-color: #3b82f6;
  }

  /* Load more */
  .btn-load-more {
    padding: 0.625rem 1.75rem;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.95rem;
    background: transparent;
    color: #3b82f6;
    border: 2px solid #3b82f6;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .btn-load-more:hover {
    background: #eff6ff;
  }

  .btn-load-more:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(html[data-theme='dark']) .btn-load-more {
    color: #60a5fa;
    border-color: #60a5fa;
  }

  :global(html[data-theme='dark']) .btn-load-more:hover {
    background: #1e293b;
  }

  /* Games divider */
  .games-divider {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 1rem 0;
  }

  :global(html[data-theme='dark']) .games-divider {
    border-top-color: #334155;
  }

  .community-games-section {
    background: #f8fafc;
    border-radius: 1rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
  }

  :global(html[data-theme='dark']) .community-games-section {
    background: #0f172a;
    border-color: #1e293b;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: var(--card-bg, #ffffff);
    border-radius: 12px;
    padding: 1.5rem;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  }

  :global(html[data-theme='dark']) .modal {
    background: #1e293b;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text-color, #0f172a);
  }

  :global(html[data-theme='dark']) .modal-header h2 {
    color: #f8fafc;
  }

  .close-btn {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #64748b;
  }

  .modal-desc {
    color: #475569;
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }

  :global(html[data-theme='dark']) .modal-desc {
    color: #94a3b8;
  }

  .class-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .class-btn {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #1e293b;
    text-align: left;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .class-btn:hover {
    border-color: #3b82f6;
    background: #eff6ff;
  }

  :global(html[data-theme='dark']) .class-btn {
    background: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
  }

  :global(html[data-theme='dark']) .class-btn:hover {
    border-color: #60a5fa;
    background: #334155;
  }
</style>
