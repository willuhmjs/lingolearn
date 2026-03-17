<script lang="ts">
  import type { PageData } from './$types';
  import { goto } from '$app/navigation';

  let { data }: { data: PageData } = $props();

  let loading = $state(false);
  let sent = $state(false);
  let apiError = $state<string | null>(null);

  async function sendRequest() {
    loading = true;
    apiError = null;
    try {
      const res = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token })
      });
      const result = await res.json();
      if (res.ok) {
        sent = true;
      } else {
        apiError = result.error || 'Failed to send friend request';
      }
    } catch {
      apiError = 'An error occurred';
    } finally {
      loading = false;
    }
  }
</script>

<div class="accept-container">
  <div class="card">
    {#if data.error}
      <div class="state-icon">⚠️</div>
      <h1>Invalid Invite</h1>
      <p class="sub">{data.error}</p>
      <a href="/friends" class="btn-primary">Go to Friends</a>
    {:else if data.existing}
      <div class="state-icon">✓</div>
      <h1>Already Friends</h1>
      <p class="sub">You and <strong>{data.inviter?.username}</strong> are already friends.</p>
      <a href="/friends" class="btn-primary">View Friends</a>
    {:else if sent}
      <div class="state-icon">🎉</div>
      <h1>You're now friends!</h1>
      <p class="sub">
        You and <strong>{data.inviter?.username}</strong> are now friends.
      </p>
      <a href="/friends" class="btn-primary">View Friends</a>
    {:else}
      <img src={data.inviter?.image || '/default-avatar.png'} alt="" class="avatar" />
      <h1>{data.inviter?.name || data.inviter?.username}</h1>
      <p class="username">@{data.inviter?.username}</p>
      <p class="sub">invited you to be friends on LingoLearn.</p>
      {#if apiError}
        <p class="error-text">{apiError}</p>
      {/if}
      <div class="actions">
        <button class="btn-primary" onclick={sendRequest} disabled={loading}>
          {loading ? 'Adding...' : 'Add Friend'}
        </button>
        <button class="btn-ghost" onclick={() => goto('/friends')} disabled={loading}>
          Decline
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .accept-container {
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .card {
    background: white;
    border-radius: 1rem;
    padding: 3rem 2rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    text-align: center;
    max-width: 400px;
    width: 100%;
  }
  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    margin: 0 auto 1rem;
    display: block;
  }
  .state-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }
  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
  }
  .username {
    color: #64748b;
    margin: 0 0 0.75rem;
    font-size: 0.9rem;
  }
  .sub {
    color: #475569;
    margin: 0 0 1.5rem;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .btn-primary,
  .btn-ghost {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-size: 1rem;
    text-decoration: none;
    display: inline-block;
  }
  .btn-primary {
    background: #3b82f6;
    color: white;
    box-shadow: 0 4px 0 #1d4ed8;
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-ghost {
    background: transparent;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }
  .btn-ghost:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .error-text {
    color: #ef4444;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
</style>
