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

<div class="profile-container">
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
  .profile-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  .card {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    margin-bottom: 2rem;
  }
  .profile-header {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  .profile-main {
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
  }
  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid #f1f5f9;
  }
  .profile-titles {
    flex: 1;
    min-width: 200px;
  }
  h1 {
    font-size: 2.5rem;
    margin: 0;
  }
  .profile-name {
    font-size: 1.25rem;
    color: #64748b;
    margin: 0.25rem 0;
  }
  .joined-date {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0;
  }
  .profile-stats {
    display: flex;
    gap: 3rem;
    border-top: 1px solid #f1f5f9;
    padding-top: 1.5rem;
  }
  .stat-item {
    display: flex;
    flex-direction: column;
  }
  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
  }
  .stat-label {
    font-size: 0.875rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border-radius: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    text-decoration: none;
    display: inline-block;
  }
  .btn-primary {
    background: #3b82f6;
    color: white;
  }
  .btn-secondary {
    background: #f1f5f9;
    color: #1e293b;
  }
  .friend-badge {
    background: #dcfce7;
    color: #166534;
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    font-weight: 600;
  }
  .pending-badge {
    background: #fef3c7;
    color: #92400e;
    padding: 0.5rem 1rem;
    border-radius: 2rem;
    font-weight: 600;
  }
  .languages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  .language-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 0.75rem;
  }
  .flag {
    font-size: 1.5rem;
  }
  .lang-info {
    display: flex;
    flex-direction: column;
  }
  .lang-name {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .cefr-badge {
    font-size: 0.75rem;
    color: #3b82f6;
    font-weight: 700;
  }
  .empty-state {
    text-align: center;
    color: #94a3b8;
    padding: 2rem 0;
  }
</style>
