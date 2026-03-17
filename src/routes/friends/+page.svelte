<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import { page } from '$app/stores';

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

<div class="friends-container">
  <header class="friends-header" in:fly={{ y: 20, duration: 400 }}>
    <h1>Social</h1>
    <p>Connect with other learners and challenge them to games.</p>
  </header>

  <div class="friends-grid">
    <section class="add-friend-section card">
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
          <button type="submit" class="btn-primary" disabled={loading || !newFriendUsername}>
            {loading ? 'Sending...' : 'Add Friend'}
          </button>
        </div>
        {#if error}
          <p class="error-text">{error}</p>
        {/if}
      </form>
      <div class="invite-link-row">
        <span class="invite-label">Or share your invite link</span>
        <button
          class="btn-copy {copyLinkSuccess ? 'copied' : ''}"
          onclick={copyInviteLink}
          disabled={copyLinkLoading}
        >
          {#if copyLinkSuccess}
            ✓ Copied!
          {:else if copyLinkLoading}
            Copying...
          {:else}
            Copy Link
          {/if}
        </button>
      </div>
    </section>

    <section class="requests-section">
      {#if incomingRequests.length > 0}
        <div class="card">
          <h2>Friend Requests</h2>
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
                    <p class="name">{request.initiator.name || ''}</p>
                  </div>
                </div>
                <div class="actions">
                  <button
                    class="btn-success"
                    onclick={() => updateFriendship(request.id, 'ACCEPTED')}>Accept</button
                  >
                  <button
                    class="btn-danger"
                    onclick={() => updateFriendship(request.id, 'DECLINED')}>Decline</button
                  >
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if outgoingRequests.length > 0}
        <div class="card">
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
                    <p class="name">{request.receiver.name || ''}</p>
                  </div>
                </div>
                <span class="status-badge pending">Pending</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>

    <section class="friends-list-section card">
      <h2>Friends</h2>
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
                  <p class="last-active">
                    Active {new Date(friend.lastActive).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div class="actions">
                <button class="btn-outline-danger" onclick={() => removeFriend(friendship.id)}
                  >Remove</button
                >
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="challenges-section card">
      <h2>Active Challenges</h2>
      {#if data.challenges.length === 0}
        <p class="empty-state">No active challenges. Play a game and challenge a friend!</p>
      {:else}
        <ul class="challenge-list">
          {#each data.challenges as challenge}
            <li class="challenge-item">
              <div class="challenge-info">
                <span class="game-title">{challenge.game.title}</span>
                <p class="challenge-status">
                  {#if challenge.challengerId === data.userId}
                    You challenged <strong>{challenge.challengee.username}</strong>
                  {:else}
                    <strong>{challenge.challenger.username}</strong> challenged you
                  {/if}
                </p>
                <p class="score-to-beat">Score to beat: {challenge.scoreToBeat}</p>
              </div>
              <div class="challenge-badge {challenge.status.toLowerCase()}">
                {challenge.status}
              </div>
              {#if challenge.challengeeId === data.userId && challenge.status === 'PENDING'}
                <div class="actions">
                  <a
                    href="/play/games/{challenge.gameId}/play?challengeId={challenge.id}"
                    class="btn-primary">Accept & Play</a
                  >
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</div>

<style>
  .friends-container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
  }
  .friends-header {
    margin-bottom: 2rem;
  }
  h1 {
    font-size: 2.5rem;
    margin: 0;
  }
  .friends-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  @media (min-width: 768px) {
    .friends-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .card {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
  h2 {
    margin-top: 0;
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }
  .input-group {
    display: flex;
    gap: 0.5rem;
  }
  input {
    flex: 1;
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
  }
  .user-list,
  .challenge-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .user-item,
  .challenge-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f1f5f9;
  }
  .user-item:last-child,
  .challenge-item:last-child {
    border-bottom: none;
  }
  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }
  .username {
    font-weight: 600;
    text-decoration: none;
    color: #1a202c;
  }
  .username:hover {
    text-decoration: underline;
  }
  .name,
  .last-active,
  .challenge-status,
  .score-to-beat {
    margin: 0;
    font-size: 0.875rem;
    color: #64748b;
  }
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  .btn-primary,
  .btn-success,
  .btn-danger,
  .btn-outline-danger {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-size: 0.875rem;
  }
  .btn-primary {
    background: #3b82f6;
    color: white;
    box-shadow: 0 4px 0 #1d4ed8;
  }
  .btn-success {
    background: #10b981;
    color: white;
  }
  .btn-danger {
    background: #ef4444;
    color: white;
  }
  .btn-outline-danger {
    background: transparent;
    border: 1px solid #ef4444;
    color: #ef4444;
  }
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .status-badge.pending {
    background: #fef3c7;
    color: #92400e;
  }
  .challenge-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
  }
  .challenge-badge.pending {
    background: #dbeafe;
    color: #1e40af;
  }
  .challenge-badge.accepted {
    background: #dcfce7;
    color: #166534;
  }
  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 2rem 0;
  }
  .error-text {
    color: #ef4444;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
  .invite-link-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f1f5f9;
    gap: 0.75rem;
  }
  .invite-label {
    font-size: 0.875rem;
    color: #64748b;
  }
  .btn-copy {
    padding: 0.4rem 0.9rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #3b82f6;
    color: #3b82f6;
    background: transparent;
    font-size: 0.875rem;
    white-space: nowrap;
    transition: background 0.15s, color 0.15s;
  }
  .btn-copy:hover:not(:disabled) {
    background: #3b82f6;
    color: white;
  }
  .btn-copy.copied {
    border-color: #10b981;
    color: #10b981;
  }
  .btn-copy:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
