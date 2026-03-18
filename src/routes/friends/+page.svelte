<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let { data }: { data: PageData } = $props();

  let newFriendUsername = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let copyLinkLoading = $state(false);
  let copyLinkSuccess = $state(false);

  async function sendRequest() {
    if (!newFriendUsername) return;
    loading = true;
    error = null;
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUsername: newFriendUsername })
      });
      const result = await res.json();
      if (res.ok) {
        newFriendUsername = '';
        await invalidateAll();
      } else {
        error = result.error || 'Failed to send request';
      }
    } catch {
      error = 'An error occurred';
    } finally {
      loading = false;
    }
  }

  async function updateFriendship(friendshipId: string, status: string) {
    try {
      const res = await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, status })
      });
      if (res.ok) {
        await invalidateAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function removeFriend(friendshipId: string) {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId })
      });
      if (res.ok) {
        await invalidateAll();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function copyInviteLink() {
    copyLinkLoading = true;
    copyLinkSuccess = false;
    try {
      const res = await fetch('/api/friends/invite');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      const origin = $page.url.origin;
      const link = `${origin}/friends/accept?token=${result.token}`;
      await navigator.clipboard.writeText(link);
      copyLinkSuccess = true;
      setTimeout(() => {
        copyLinkSuccess = false;
      }, 3000);
    } catch {
      error = 'Could not copy invite link';
    } finally {
      copyLinkLoading = false;
    }
  }

  let friends = $derived(data.friendships.filter((f) => f.status === 'ACCEPTED'));
  let incomingRequests = $derived(
    data.friendships.filter((f) => f.status === 'PENDING' && f.receiverId === data.userId)
  );
  let outgoingRequests = $derived(
    data.friendships.filter((f) => f.status === 'PENDING' && f.initiatorId === data.userId)
  );
</script>

<div class="page-shell">
  <PageHeader title="Social" subtitle="Connect with other learners and challenge them to games." />

  <div class="friends-grid">
    <!-- Add Friend -->
    <section class="card" in:fly={{ y: 16, duration: 300, delay: 60 }}>
      <h2>Add Friend</h2>
      <form
        onsubmit={(e) => {
          e.preventDefault();
          sendRequest();
        }}
      >
        <div class="input-group">
          <input
            type="text"
            bind:value={newFriendUsername}
            placeholder="Enter username..."
            disabled={loading}
          />
          <button type="submit" class="btn-duo btn-primary" disabled={loading || !newFriendUsername}>
            {loading ? 'Sending…' : 'Add'}
          </button>
        </div>
        {#if error}
          <p class="field-error">{error}</p>
        {/if}
      </form>
      <div class="invite-row">
        <span class="invite-label">Or share an invite link</span>
        <button
          class="btn-copy {copyLinkSuccess ? 'copied' : ''}"
          onclick={copyInviteLink}
          disabled={copyLinkLoading}
        >
          {#if copyLinkSuccess}
            ✓ Copied!
          {:else if copyLinkLoading}
            Copying…
          {:else}
            Copy Link
          {/if}
        </button>
      </div>
    </section>

    <!-- Incoming / outgoing requests -->
    <section class="requests-section">
      {#if incomingRequests.length > 0}
        <div class="card" in:fly={{ y: 16, duration: 300, delay: 90 }}>
          <h2>
            Friend Requests
            <span class="badge-count">{incomingRequests.length}</span>
          </h2>
          <ul class="user-list">
            {#each incomingRequests as request}
              <li class="user-item">
                <div class="user-info">
                  <img
                    src={request.initiator.image || '/default-avatar.png'}
                    alt=""
                    class="avatar"
                  />
                  <div>
                    <a href="/u/{request.initiator.username}" class="username"
                      >{request.initiator.username}</a
                    >
                    {#if request.initiator.name}
                      <p class="meta">{request.initiator.name}</p>
                    {/if}
                  </div>
                </div>
                <div class="actions">
                  <button
                    class="btn-sm btn-accept"
                    onclick={() => updateFriendship(request.id, 'ACCEPTED')}>Accept</button
                  >
                  <button
                    class="btn-sm btn-decline"
                    onclick={() => updateFriendship(request.id, 'DECLINED')}>Decline</button
                  >
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if outgoingRequests.length > 0}
        <div class="card" in:fly={{ y: 16, duration: 300, delay: 120 }}>
          <h2>Sent Requests</h2>
          <ul class="user-list">
            {#each outgoingRequests as request}
              <li class="user-item">
                <div class="user-info">
                  <img
                    src={request.receiver.image || '/default-avatar.png'}
                    alt=""
                    class="avatar"
                  />
                  <div>
                    <a href="/u/{request.receiver.username}" class="username"
                      >{request.receiver.username}</a
                    >
                    {#if request.receiver.name}
                      <p class="meta">{request.receiver.name}</p>
                    {/if}
                  </div>
                </div>
                <span class="status-pill pending">Pending</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>

    <!-- Friends list -->
    <section class="card" in:fly={{ y: 16, duration: 300, delay: 150 }}>
      <h2>Friends <span class="badge-count">{friends.length}</span></h2>
      {#if friends.length === 0}
        <p class="empty-state">No friends yet. Add some people to see them here!</p>
      {:else}
        <ul class="user-list">
          {#each friends as friendship}
            {@const friend =
              friendship.initiatorId === data.userId ? friendship.receiver : friendship.initiator}
            <li class="user-item">
              <div class="user-info">
                <img src={friend.image || '/default-avatar.png'} alt="" class="avatar" />
                <div>
                  <a href="/u/{friend.username}" class="username">{friend.username}</a>
                  <p class="meta">
                    Active {new Date(friend.lastActive).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button class="btn-sm btn-remove" onclick={() => removeFriend(friendship.id)}
                >Remove</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Challenges -->
    <section class="card" in:fly={{ y: 16, duration: 300, delay: 180 }}>
      <h2>Active Challenges</h2>
      {#if data.challenges.length === 0}
        <p class="empty-state">No active challenges. Play a game and challenge a friend!</p>
      {:else}
        <ul class="challenge-list">
          {#each data.challenges as challenge}
            <li class="challenge-item">
              <div class="challenge-info">
                <span class="game-title">{challenge.game.title}</span>
                <p class="meta">
                  {#if challenge.challengerId === data.userId}
                    You challenged <strong>{challenge.challengee.username}</strong>
                  {:else}
                    <strong>{challenge.challenger.username}</strong> challenged you
                  {/if}
                </p>
                <p class="meta">Score to beat: <strong>{challenge.scoreToBeat}</strong></p>
              </div>
              <div class="challenge-right">
                <span class="status-pill {challenge.status.toLowerCase()}">{challenge.status}</span>
                {#if challenge.challengeeId === data.userId && challenge.status === 'PENDING'}
                  <a
                    href="/play/games/{challenge.gameId}/play?challengeId={challenge.id}"
                    class="btn-duo btn-primary btn-sm-duo">Accept & Play</a
                  >
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</div>

<style>
  /* ── Layout ──────────────────────────────────────────────────── */
  .friends-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .friends-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* ── Cards ───────────────────────────────────────────────────── */
  .card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .card h2 {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-color, #111827);
    margin: 0 0 1.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge-count {
    background: var(--card-border, #e5e7eb);
    color: var(--text-muted, #64748b);
    font-size: 0.7rem;
    font-weight: 800;
    border-radius: 9999px;
    padding: 0.1rem 0.5rem;
    line-height: 1.4;
  }

  /* ── Add-friend form ─────────────────────────────────────────── */
  .input-group {
    display: flex;
    gap: 0.5rem;
  }

  .input-group input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-family: inherit;
    color: var(--input-text, #111827);
    background: var(--input-bg, #ffffff);
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .input-group input:focus {
    outline: none;
    border-color: #58cc02;
    box-shadow: 0 0 0 3px rgba(88, 204, 2, 0.12);
  }

  .input-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .field-error {
    margin: 0.4rem 0 0;
    font-size: 0.8rem;
    color: #ef4444;
    font-weight: 500;
  }

  /* ── Invite row ──────────────────────────────────────────────── */
  .invite-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--card-border, #e5e7eb);
  }

  .invite-label {
    font-size: 0.825rem;
    color: var(--text-muted, #64748b);
  }

  .btn-copy {
    padding: 0.375rem 0.875rem;
    border-radius: 0.5rem;
    font-weight: 700;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    border: 1.5px solid var(--card-border, #e5e7eb);
    color: var(--text-color, #374151);
    background: transparent;
    white-space: nowrap;
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s;
  }

  .btn-copy:hover:not(:disabled) {
    background: var(--link-hover-bg, #ddf4ff);
    border-color: #1cb0f6;
    color: #1cb0f6;
  }

  .btn-copy.copied {
    border-color: #58cc02;
    color: #58cc02;
  }

  .btn-copy:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── User lists ──────────────────────────────────────────────── */
  .user-list,
  .challenge-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .user-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--card-border, #e5e7eb);
    gap: 0.75rem;
  }

  .user-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid var(--card-border, #e5e7eb);
  }

  .username {
    font-weight: 700;
    font-size: 0.9rem;
    text-decoration: none;
    color: var(--text-color, #111827);
    display: block;
  }

  .username:hover {
    color: #1cb0f6;
    text-decoration: underline;
  }

  .meta {
    margin: 0.1rem 0 0;
    font-size: 0.78rem;
    color: var(--text-muted, #64748b);
  }

  .actions {
    display: flex;
    gap: 0.4rem;
    flex-shrink: 0;
  }

  /* ── Small buttons ───────────────────────────────────────────── */
  .btn-sm {
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.78rem;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    border: none;
    transition:
      filter 0.15s,
      transform 0.1s;
    white-space: nowrap;
  }

  .btn-sm:active {
    transform: scale(0.97);
  }

  .btn-accept {
    background: #58cc02;
    color: white;
    box-shadow: 0 2px 0 #58a700;
  }

  .btn-accept:hover {
    filter: brightness(1.07);
  }

  .btn-decline {
    background: transparent;
    border: 1.5px solid var(--card-border, #e5e7eb) !important;
    color: var(--text-muted, #64748b);
  }

  .btn-decline:hover {
    border-color: #ef4444 !important;
    color: #ef4444;
  }

  .btn-remove {
    background: transparent;
    border: 1.5px solid var(--card-border, #e5e7eb) !important;
    color: var(--text-muted, #64748b);
    font-size: 0.75rem;
  }

  .btn-remove:hover {
    border-color: #ef4444 !important;
    color: #ef4444;
  }

  /* btn-duo size override for inline challenge CTA */
  .btn-sm-duo {
    padding: 0.4rem 0.9rem;
    font-size: 0.8rem;
    border-radius: 0.6rem;
    box-shadow: 0 2px 0 #58a700;
  }

  /* ── Status pills ────────────────────────────────────────────── */
  .status-pill {
    padding: 0.2rem 0.65rem;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .status-pill.pending {
    background: #fef9c3;
    color: #854d0e;
  }

  .status-pill.accepted {
    background: #dcfce7;
    color: #166534;
  }

  .status-pill.completed {
    background: var(--card-border, #e5e7eb);
    color: var(--text-muted, #64748b);
  }

  /* ── Challenges ──────────────────────────────────────────────── */
  .challenge-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 0;
    border-bottom: 1px solid var(--card-border, #e5e7eb);
  }

  .challenge-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .challenge-info {
    min-width: 0;
  }

  .game-title {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text-color, #111827);
    display: block;
    margin-bottom: 0.2rem;
  }

  .challenge-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ── Empty state ─────────────────────────────────────────────── */
  .empty-state {
    text-align: center;
    color: var(--text-muted, #94a3b8);
    font-size: 0.875rem;
    padding: 1.5rem 0;
    margin: 0;
  }

  /* ── Requests section stacking ───────────────────────────────── */
  .requests-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ── Dark mode pill overrides ────────────────────────────────── */
  :global(html[data-theme='dark']) .status-pill.pending {
    background: #422006;
    color: #fde68a;
  }

  :global(html[data-theme='dark']) .status-pill.accepted {
    background: #14532d;
    color: #86efac;
  }
</style>
