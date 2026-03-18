<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { fly } from 'svelte/transition';
  import type { PageData } from './$types';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { toastError, toastSuccess } from '$lib/utils/toast';
  import PageHeader from '$lib/components/PageHeader.svelte';

  let { data }: { data: PageData } = $props();

  let createName = $state('');
  let createDescription = $state('');
  let createLanguage = $state('international');
  let isCreating = $state(false);

  let joinCode = $state('');
  let isJoining = $state(false);

  let activeTab: 'create' | 'join' = $state('join');

  onMount(() => {
    const codeParam = $page.url.searchParams.get('code');
    if (codeParam) {
      joinCode = codeParam;
      activeTab = 'join';
      handleJoin();
    }
  });

  async function handleCreate() {
    if (!createName || isCreating) return;
    isCreating = true;

    try {
      const res = await fetch('/api/classes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          description: createDescription,
          primaryLanguage: createLanguage
        })
      });
      const result = await res.json();
      if (!res.ok) {
        toastError(result.error || 'Failed to create class');
      } else {
        toastSuccess('Class created successfully!');
        createName = '';
        createDescription = '';
        createLanguage = 'international';
        await invalidateAll();
      }
    } catch (_) {
      toastError('An error occurred');
    } finally {
      isCreating = false;
    }
  }

  async function handleJoin() {
    if (!joinCode || isJoining) return;
    isJoining = true;

    try {
      const res = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode })
      });
      const result = await res.json();
      if (!res.ok) {
        toastError(result.error || 'Failed to join class');
      } else {
        toastSuccess('Joined class successfully!');
        joinCode = '';
        await invalidateAll();
      }
    } catch (_) {
      toastError('An error occurred');
    } finally {
      isJoining = false;
    }
  }
</script>

<svelte:head>
  <title>My Classes - LingoLearn</title>
</svelte:head>

<div class="page-shell wide">
  <PageHeader title="Classes" subtitle="Manage your classes and learning groups." />

  <div class="classes-layout">
    <!-- List of Classes -->
    <section class="my-classes-section" in:fly={{ y: 20, duration: 400, delay: 100 }}>
      {#if data.classes && data.classes.length > 0}
        <div class="classes-grid">
          {#each data.classes as cls}
            <a href="/classes/{cls.id}" class="card-duo class-card">
              <h3 class="class-card-name">{cls.name}</h3>
              {#if cls.description}
                <p class="class-card-desc">{cls.description}</p>
              {:else}
                <div class="class-card-spacer"></div>
              {/if}
              <div class="class-card-meta">
                <span class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                    />
                  </svg>
                  {cls.members.length} members
                </span>
                <span class="meta-item">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H7z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {cls.assignments.length} tasks
                </span>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <div class="empty-icon-wrap">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <p class="empty-title">No classes yet</p>
          <p class="empty-desc">
            Create a class to assign homework or join one with an invite code.
          </p>
          <div class="empty-actions">
            <button
              class="empty-cta-secondary"
              onclick={() => {
                activeTab = 'join';
                document.querySelector('.forms-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Join with Code
            </button>
            <button
              class="empty-cta"
              onclick={() => {
                activeTab = 'create';
                document.querySelector('.forms-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Create a Class
            </button>
          </div>
        </div>
      {/if}
    </section>

    <!-- Create / Join Forms -->
    <section class="forms-section" in:fly={{ y: 20, duration: 400, delay: 200 }}>
      <div class="tabs-container">
        <div class="tabs">
          <button
            class="tab-btn tab-join"
            class:active={activeTab === 'join'}
            onclick={() => (activeTab = 'join')}
          >
            Join Class
          </button>
          <button
            class="tab-btn tab-create"
            class:active={activeTab === 'create'}
            onclick={() => (activeTab = 'create')}
          >
            Create Class
          </button>
        </div>
      </div>

      {#if activeTab === 'create'}
        <div class="form-card-wrapper" in:fly={{ y: 10, duration: 300 }}>
          <div class="card-duo form-card create-card">
            <div class="card-header">
              <div class="icon-wrapper create-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2>Create a Class</h2>
              <p class="card-subtitle">Start a new learning group</p>
            </div>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              class="form-inner"
            >
              <div class="field">
                <label for="name">Class Name</label>
                <div class="input-wrapper">
                  <input
                    type="text"
                    id="name"
                    bind:value={createName}
                    placeholder="e.g. German 101"
                    required
                    disabled={isCreating}
                  />
                </div>
              </div>
              <div class="field">
                <label for="description">Description <span class="optional">(Optional)</span></label
                >
                <div class="input-wrapper">
                  <textarea
                    id="description"
                    bind:value={createDescription}
                    placeholder="What is this class about?"
                    rows="2"
                    disabled={isCreating}
                  ></textarea>
                </div>
              </div>
              <div class="field">
                <label for="language">Primary Language</label>
                <div class="input-wrapper select-wrapper">
                  <select id="language" bind:value={createLanguage} disabled={isCreating}>
                    <option value="international">🌍 International</option>
                    <option value="de">🇩🇪 German</option>
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="fr">🇫🇷 French</option>
                  </select>
                </div>
              </div>
              <div class="form-actions">
                <button
                  type="submit"
                  disabled={isCreating || !createName}
                  class="btn-duo btn-primary btn-full"
                >
                  {isCreating ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      {:else}
        <div class="form-card-wrapper" in:fly={{ y: 10, duration: 300 }}>
          <div class="card-duo form-card join-card">
            <div class="card-header">
              <div class="icon-wrapper join-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h2>Join a Class</h2>
              <p class="card-subtitle">Enter a code from your teacher</p>
            </div>
            <form
              onsubmit={(e) => {
                e.preventDefault();
                handleJoin();
              }}
              class="form-inner"
            >
              <div class="field">
                <label for="inviteCode">Invite Code</label>
                <div class="code-input-container">
                  <input
                    type="text"
                    id="inviteCode"
                    bind:value={joinCode}
                    placeholder="------"
                    class="invite-code-input"
                    maxlength="6"
                    required
                    autocomplete="off"
                    disabled={isJoining}
                  />
                  <div class="code-format-hint">6 alphanumeric characters</div>
                </div>
              </div>
              <div class="form-actions">
                <button
                  type="submit"
                  disabled={isJoining || joinCode.length < 6}
                  class="btn-duo btn-join btn-full"
                >
                  {isJoining ? 'Joining...' : 'Join Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  :global(.btn-join) {
    background-color: #f97316;
    color: white;
    border-color: transparent;
    box-shadow: 0 4px 0 #c2410c;
  }
  :global(.btn-join:hover:not(:disabled)) {
    background-color: #fb923c;
    transform: scale(1.02);
  }
  :global(.btn-join:active:not(:disabled)) {
    transform: scale(0.98) translateY(2px);
    box-shadow: 0 2px 0 #c2410c;
  }
  :global(.btn-join:disabled) {
    background-color: #e5e7eb;
    color: #9ca3af;
    box-shadow: 0 4px 0 #d1d5db;
    cursor: not-allowed;
    transform: none;
  }

  :global(.btn-primary:disabled) {
    background-color: #e5e7eb;
    color: #9ca3af;
    box-shadow: 0 4px 0 #d1d5db;
    cursor: not-allowed;
    transform: none;
  }

  :global(.btn-full) {
    width: 100%;
  }

  .classes-layout {
    display: grid;
    grid-template-columns: 1fr 440px;
    gap: 2.5rem;
    align-items: start;
  }

  .forms-section {
    margin-top: 0;
  }

  .tabs-container {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .tabs {
    display: flex;
    background: #f1f5f9;
    padding: 0.5rem;
    border-radius: 1rem;
    gap: 0.5rem;
  }

  :global(html[data-theme='dark']) .tabs {
    background: #1e293b;
  }

  .tab-btn {
    padding: 0.75rem 2rem;
    border-radius: 0.75rem;
    font-weight: bold;
    font-size: 1rem;
    color: #64748b;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: #1e293b;
    background: #e2e8f0;
  }

  :global(html[data-theme='dark']) .tab-btn:hover {
    color: #f8fafc;
    background: #334155;
  }

  .tab-btn.active {
    background: white;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .tab-join.active {
    color: #f97316;
  }
  .tab-create.active {
    color: #22c55e;
  }

  :global(html[data-theme='dark']) .tab-btn.active {
    background: #0f172a;
  }

  :global(html[data-theme='dark']) .tab-join.active {
    color: #fb923c;
  }
  :global(html[data-theme='dark']) .tab-create.active {
    color: #4ade80;
  }

  .form-card-wrapper {
    max-width: 100%;
    margin: 0;
  }

  .form-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .create-card {
    border-top: 6px solid #22c55e;
  }

  .join-card {
    border-top: 6px solid #f97316;
  }

  .card-header {
    text-align: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 2px dashed var(--card-border, #e2e8f0);
  }

  .icon-wrapper {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  .icon-wrapper svg {
    width: 2rem;
    height: 2rem;
    stroke-width: 2.5;
  }

  .create-icon {
    background-color: #dcfce7;
    color: #16a34a;
  }

  .join-icon {
    background-color: #ffedd5;
    color: #ea580c;
  }

  .form-card h2 {
    font-size: 1.5rem;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.25rem;
    border: none;
    padding: 0;
  }

  .card-subtitle {
    color: #64748b;
    font-size: 0.95rem;
    margin: 0;
  }

  .form-inner {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    gap: 1.25rem;
  }

  .field label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 800;
    color: #475569;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .field label .optional {
    color: #94a3b8;
    font-weight: 600;
  }

  .input-wrapper {
    position: relative;
  }

  .field input,
  .field textarea,
  .field select {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 1rem;
    border: 2px solid var(--card-border, #e5e7eb);
    background-color: var(--input-bg, #ffffff);
    color: var(--text-color, #1e293b);
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    transition: all 0.2s;
    box-sizing: border-box;
    outline: none;
  }

  .field input:focus,
  .field textarea:focus,
  .field select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }

  .create-card .field input:focus,
  .create-card .field textarea:focus,
  .create-card .field select:focus {
    border-color: #22c55e;
    box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
  }

  .join-card .field input:focus {
    border-color: #f97316;
    box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.1);
  }

  .field textarea {
    resize: none;
  }

  .select-wrapper::after {
    content: '';
    position: absolute;
    right: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #64748b;
    pointer-events: none;
  }

  .field select {
    appearance: none;
    padding-right: 2.5rem;
  }

  .code-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .invite-code-input {
    text-align: center;
    font-size: 1.75rem !important;
    font-weight: 900 !important;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    padding: 1rem !important;
    color: #c2410c !important;
    background-color: #fff7ed !important;
    border-color: #fed7aa !important;
  }

  .invite-code-input::placeholder {
    color: #fdba74;
    letter-spacing: 0.3em;
  }

  .code-format-hint {
    text-align: center;
    font-size: 0.8rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .form-actions {
    margin-top: auto;
    padding-top: 1rem;
  }

  .my-classes-section {
    margin-top: 0;
    min-width: 0;
  }

  .classes-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 640px) {
    .classes-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .class-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }

  .class-card-name {
    font-size: 1.2rem;
    color: var(--text-color, #1e293b);
    margin: 0 0 0.5rem;
    transition: color 0.2s;
  }

  .class-card:hover .class-card-name {
    color: #3b82f6;
  }

  .class-card-desc {
    color: #64748b;
    font-size: 0.95rem;
    margin: 0 0 1.25rem;
    flex-grow: 1;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
  }

  .class-card-spacer {
    flex-grow: 1;
  }

  .class-card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 2px solid var(--card-border, #e5e7eb);
    font-size: 0.8rem;
    font-weight: 800;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .meta-item svg {
    width: 1.1rem;
    height: 1.1rem;
  }

  .empty-state {
    text-align: center;
    padding: 3.5rem 2rem;
    background: var(--card-bg, #f8fafc);
    border-radius: 1.5rem;
    border: 3px dashed var(--card-border, #cbd5e1);
    color: #94a3b8;
  }

  .empty-icon-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    background: var(--card-border, #e2e8f0);
    margin-bottom: 1.25rem;
  }

  .empty-icon-wrap svg {
    width: 2.5rem;
    height: 2.5rem;
    opacity: 0.5;
  }

  .empty-state svg {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1rem;
    opacity: 0.5;
  }

  .empty-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: #64748b;
    margin: 0 0 0.5rem;
  }

  .empty-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }

  .empty-cta {
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.75rem;
    padding: 0.65rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 3px 0 #2563eb;
    font-family: inherit;
    transition: background 0.15s;
  }

  .empty-cta:hover {
    background: #2563eb;
  }

  .empty-cta-secondary {
    background: #f97316;
    color: white;
    border: none;
    border-radius: 0.75rem;
    padding: 0.65rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 3px 0 #c2410c;
    font-family: inherit;
    transition: background 0.15s;
  }

  .empty-cta-secondary:hover {
    background: #ea6c00;
  }

  .empty-desc {
    color: #94a3b8;
    margin: 0;
    font-size: 0.95rem;
  }

  @media (max-width: 900px) {
    .classes-layout {
      grid-template-columns: 1fr;
    }

    .forms-section {
      margin-top: 0;
    }
  }

  @media (max-width: 768px) {
    .btn-duo {
      width: 100%;
      box-sizing: border-box;
    }
  }
</style>
