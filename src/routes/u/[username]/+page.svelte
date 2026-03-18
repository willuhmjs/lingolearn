<script lang="ts">
  import type { PageData } from './$types';
  import { invalidateAll } from '$app/navigation';
  import { fly } from 'svelte/transition';

  let { data }: { data: PageData } = $props();

  let loading = $state(false);

  async function addFriend() {
    loading = true;
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUsername: data.profile.username })
      });
      if (res.ok) {
        await invalidateAll();
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }
</script>

<div class="page-shell">
  <div class="profile-header card" in:fly={{ y: 20, duration: 400 }}>
    <div class="profile-main">
      <img src={data.profile.image || '/default-avatar.png'} alt="" class="profile-avatar" />
      <div class="profile-titles">
        <h1>{data.profile.username}</h1>
        <p class="profile-name">{data.profile.name || ''}</p>
        <p class="joined-date">Joined {new Date(data.profile.createdAt).toLocaleDateString()}</p>
      </div>
      <div class="profile-actions">
        {#if data.isOwnProfile}
          <a href="/profile" class="btn-secondary">Edit Profile</a>
        {:else if data.friendshipStatus === 'ACCEPTED'}
          <span class="friend-badge">✓ Friend</span>
        {:else if data.friendshipStatus === 'PENDING'}
          <span class="pending-badge">Request Pending</span>
        {:else}
          <button class="btn-primary" onclick={addFriend} disabled={loading}>
            {loading ? 'Sending...' : 'Add Friend'}
          </button>
        {/if}
      </div>
    </div>

    <div class="profile-stats">
      <div class="stat-item">
        <span class="stat-value">{data.profile.totalXp}</span>
        <span class="stat-label">Total XP</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{data.profile.currentStreak}</span>
        <span class="stat-label">Current Streak</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">{data.profile.longestStreak}</span>
        <span class="stat-label">Longest Streak</span>
      </div>
    </div>
  </div>

  <div class="profile-content">
    <section class="languages-section card">
      <h2>Languages</h2>
      {#if data.profile.progress.length === 0}
        <p class="empty-state">No languages started yet.</p>
      {:else}
        <div class="languages-grid">
          {#each data.profile.progress as prog}
            <div class="language-card">
              <span class="flag">{prog.language.flag}</span>
              <div class="lang-info">
                <span class="lang-name">{prog.language.name}</span>
                <span class="cefr-badge">{prog.cefrLevel}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .profile-main {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .profile-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--card-border, #e5e7eb);
    flex-shrink: 0;
  }

  .profile-titles {
    flex: 1;
    min-width: 160px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-color, #111827);
    margin: 0 0 0.15rem;
  }

  .profile-name {
    font-size: 0.925rem;
    color: var(--text-muted, #64748b);
    margin: 0 0 0.1rem;
  }

  .joined-date {
    font-size: 0.78rem;
    color: var(--text-muted, #94a3b8);
    margin: 0;
  }

  .profile-stats {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    border-top: 1px solid var(--card-border, #e5e7eb);
    padding-top: 1.25rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text-color, #111827);
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }

  .friend-badge {
    background: #dcfce7;
    color: #166534;
    padding: 0.35rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .pending-badge {
    background: #fef9c3;
    color: #854d0e;
    padding: 0.35rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
  }

  :global(html[data-theme='dark']) .friend-badge {
    background: #14532d;
    color: #86efac;
  }

  :global(html[data-theme='dark']) .pending-badge {
    background: #422006;
    color: #fde68a;
  }

  .languages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .language-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.75rem 1rem;
    background: var(--bg-color, #f8fafc);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.6rem;
  }

  .flag {
    font-size: 1.4rem;
    line-height: 1;
  }

  .lang-info {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .lang-name {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--text-color, #111827);
  }

  .cefr-badge {
    font-size: 0.72rem;
    color: #2563eb;
    font-weight: 800;
  }

  .empty-state {
    text-align: center;
    color: var(--text-muted, #94a3b8);
    font-size: 0.875rem;
    padding: 1.5rem 0;
    margin: 0;
  }

  .languages-section h2 {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-color, #111827);
    margin: 0 0 0.75rem;
  }
</style>
