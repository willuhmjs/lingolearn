<script lang="ts">
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { modal } from '$lib/modal.svelte';
  import { fly } from 'svelte/transition';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { untrack } from 'svelte';
  import type { PageData, ActionData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();

  let isRunningSeed = $state(false);

  // Language data management state
  let selectedLangId = $state('');
  let isExporting = $state(false);
  let isExportingAll = $state(false);
  let isExportingFull = $state(false);
  let importAllFile = $state<FileList | undefined>();
  let isImportingAll = $state(false);
  let showImportAllConfirm = $state(false);
  let importFullFile = $state<FileList | undefined>();
  let isImportingFull = $state(false);
  let showImportFullConfirm = $state(false);
  let isImporting = $state(false);
  let importFile = $state<FileList | undefined>();
  let langDataMsg = $state('');
  let langDataError = $state(false);
  let showDeleteLangConfirm = $state(false);
  let deleteScope = $state<'vocab' | 'grammar' | 'all'>('all');
  let isDeletingLangData = $state(false);

  // LLM config state — untrack intentionally: these are editable form fields seeded from server data
  let llmEndpoint = $state(untrack(() => data.llmEndpoint || ''));
  let llmApiKey = $state(untrack(() => data.llmApiKey || ''));
  let llmModel = $state(untrack(() => data.llmModel || ''));
  let availableModels = $state<string[]>([]);
  let isFetchingModels = $state(false);
  let llmMsg = $state('');
  let llmError = $state(false);

  // AI Check state
  let isCheckingAI = $state(false);
  let aiCheckResult = $state('');

  let aiCheckProgress = $state('');

  async function runAICheckAll() {
    if (data.pendingVocab.length === 0) return;

    isCheckingAI = true;
    aiCheckResult = '';
    aiCheckProgress = `Checking 0 of ${data.pendingVocab.length} words...`;

    try {
      const batchSize = 10;
      let totalApproved = 0;
      let totalRejected = 0;
      const totalWords = data.pendingVocab.length;

      for (let i = 0; i < totalWords; i += batchSize) {
        const batch = data.pendingVocab.slice(i, i + batchSize);
        aiCheckProgress = `Checking ${Math.min(i + batchSize, totalWords)} of ${totalWords} words...`;

        const res = await fetch('/api/admin/vocabulary/ai-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words: batch })
        });

        const result = await res.json();

        if (res.ok) {
          totalApproved += result.approvedCount;
          totalRejected += result.rejectedCount;
          aiCheckResult = `Checking in progress... ${totalApproved} approved, ${totalRejected} rejected so far.`;
        } else {
          console.error('Batch error:', result.error);
          await modal.alert(
            `Error on batch ${i / batchSize + 1}: ${result.error || 'Failed to run AI check.'}`
          );
          break; // Stop on error
        }
      }

      aiCheckResult = `AI Check complete: ${totalApproved} approved, ${totalRejected} rejected.`;
      await invalidateAll();
    } catch (error) {
      console.error('AI check error:', error);
      await modal.alert('An error occurred during AI check.');
    } finally {
      isCheckingAI = false;
      aiCheckProgress = '';
    }
  }

  async function runAutoReview() {
    try {
      const res = await fetch('/api/admin/vocabulary/auto-review', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        if (result.approvedCount > 0 || result.rejectedCount > 0) {
          aiCheckResult = `Auto-review (older than 24h) complete: ${result.approvedCount} approved, ${result.rejectedCount} rejected.`;
          await invalidateAll();
        }
      }
    } catch (error) {
      console.error('Auto-review check error:', error);
    }
  }

  // Fetch models whenever endpoint changes, or initially if we have an endpoint
  async function fetchModels() {
    if (!llmEndpoint) {
      availableModels = [];
      return;
    }

    isFetchingModels = true;
    try {
      // Append /v1/models if the endpoint doesn't already end with it. Often base URL is provided.
      let fetchUrl = llmEndpoint;
      if (!fetchUrl.endsWith('/v1/models') && !fetchUrl.endsWith('/v1/models/')) {
        fetchUrl = fetchUrl.replace(/\/+$/, '') + '/v1/models';
      }

      const headers: Record<string, string> = {};
      if (llmApiKey) {
        headers['Authorization'] = `Bearer ${llmApiKey}`;
      }

      const res = await fetch(fetchUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && data.data && Array.isArray(data.data)) {
          availableModels = data.data.map((m: any) => m.id);
        } else if (Array.isArray(data)) {
          // Some providers might just return an array
          availableModels = data.map((m: any) => m.id || m);
        } else {
          availableModels = [];
        }
      } else {
        availableModels = [];
      }
    } catch (error) {
      console.error('Failed to fetch models', error);
      availableModels = [];
    } finally {
      isFetchingModels = false;
    }
  }

  // Svelte onMount is better for initial fetch to avoid SSR issues
  import { onMount } from 'svelte';
  onMount(() => {
    if (llmEndpoint) fetchModels();
    runAutoReview();
  });

  let selectedLang = $derived(data.languages.find((l: any) => l.id === selectedLangId));

  async function exportLangData() {
    if (!selectedLangId) return;
    isExporting = true;
    await downloadBlob(
      `/api/admin/language-data?languageId=${selectedLangId}`,
      'language-data.json'
    );
    isExporting = false;
  }

  async function downloadBlob(url: string, fallbackName: string) {
    const res = await fetch(url);
    if (!res.ok) {
      langDataMsg = 'Export failed.';
      langDataError = true;
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const fnMatch = cd.match(/filename="([^"]+)"/);
    const filename = fnMatch ? fnMatch[1] : fallbackName;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    langDataMsg = `Exported ${filename}`;
    langDataError = false;
  }

  async function exportAllLangData() {
    isExportingAll = true;
    await downloadBlob('/api/admin/language-data', 'all-language-data.json');
    isExportingAll = false;
  }

  async function exportEverything() {
    isExportingFull = true;
    await downloadBlob('/api/admin/export', 'full-export.json');
    isExportingFull = false;
  }

  async function importAllLangData() {
    if (!importAllFile?.length) return;
    isImportingAll = true;
    showImportAllConfirm = false;
    const text = await importAllFile[0].text();
    try {
      const payload = JSON.parse(text);
      const res = await fetch('/api/admin/language-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) {
        langDataMsg = result.error || 'Import failed.';
        langDataError = true;
      } else {
        const v = result.vocab;
        const g = result.grammar;
        langDataMsg = `All-languages import complete — ${result.languagesProcessed} languages · Vocab: +${v.created} created, ${v.updated} updated · Grammar: +${g.created} created, ${g.updated} updated`;
        langDataError = false;
        await invalidateAll();
      }
    } catch {
      langDataMsg = 'Invalid JSON file.';
      langDataError = true;
    } finally {
      isImportingAll = false;
      importAllFile = undefined;
    }
  }

  async function importFullData() {
    if (!importFullFile?.length) return;
    isImportingFull = true;
    showImportFullConfirm = false;
    const text = await importFullFile[0].text();
    try {
      const payload = JSON.parse(text);
      const res = await fetch('/api/admin/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) {
        langDataMsg = result.error || 'Import failed.';
        langDataError = true;
      } else {
        const s = result.stats;
        langDataMsg = `Full import complete — ${s.languages.processed} languages · Vocab: +${s.languages.vocabCreated} created, ${s.languages.vocabUpdated} updated · Grammar: +${s.languages.grammarCreated} created, ${s.languages.grammarUpdated} updated · Users updated: ${s.users.updated} (${s.users.skipped} skipped) · Progress entries: ${s.users.progressUpserted} · Classes: +${s.classes.created} created, ${s.classes.updated} updated`;
        langDataError = false;
        await invalidateAll();
      }
    } catch {
      langDataMsg = 'Invalid JSON file.';
      langDataError = true;
    } finally {
      isImportingFull = false;
      importFullFile = undefined;
    }
  }

  async function importLangData() {
    if (!selectedLangId || !importFile?.length) return;
    isImporting = true;
    const text = await importFile[0].text();
    try {
      const payload = JSON.parse(text);
      const res = await fetch('/api/admin/language-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, languageId: selectedLangId })
      });
      const result = await res.json();
      if (!res.ok) {
        langDataMsg = result.error || 'Import failed.';
        langDataError = true;
      } else {
        const v = result.vocab;
        const g = result.grammar;
        langDataMsg = `Import complete — Vocab: +${v.created} created, ${v.updated} updated · Grammar: +${g.created} created, ${g.updated} updated`;
        langDataError = false;
        await invalidateAll();
      }
    } catch {
      langDataMsg = 'Invalid JSON file.';
      langDataError = true;
    } finally {
      isImporting = false;
    }
  }

  async function deleteLangData() {
    if (!selectedLangId) return;
    isDeletingLangData = true;
    const res = await fetch(
      `/api/admin/language-data?languageId=${selectedLangId}&scope=${deleteScope}`,
      { method: 'DELETE' }
    );
    const result = await res.json();
    isDeletingLangData = false;
    showDeleteLangConfirm = false;
    if (!res.ok) {
      langDataMsg = result.error || 'Delete failed.';
      langDataError = true;
    } else {
      langDataMsg = `Deleted ${result.vocabDeleted} vocab + ${result.grammarDeleted} grammar entries.`;
      langDataError = false;
      await invalidateAll();
    }
  }

  // Modal state
  let editingUser = $state<{
    id: string;
    username: string;
    email: string;
    role: string;
    progress: Array<{
      languageId: string;
      languageName: string;
      cefrLevel: string;
      hasOnboarded: boolean;
    }>;
  } | null>(null);

  let isSaving = $state(false);
  let isDeleting = $state(false);
  let modalError = $state('');
  let showDeleteConfirm = $state(false);

  function openEditModal(user: (typeof data.users)[number]) {
    editingUser = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role,
      progress: user.progress.map((p) => ({
        languageId: p.languageId,
        languageName: p.language.name,
        cefrLevel: p.cefrLevel,
        hasOnboarded: p.hasOnboarded
      }))
    };
    modalError = '';
    showDeleteConfirm = false;
  }

  function closeModal() {
    editingUser = null;
    modalError = '';
    showDeleteConfirm = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeModal();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeModal();
  }

  async function saveUser() {
    if (!editingUser) return;
    isSaving = true;
    modalError = '';

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editingUser.username,
          email: editingUser.email,
          role: editingUser.role,
          progress: editingUser.progress
        })
      });

      const result = await res.json();

      if (!res.ok) {
        modalError = result.error || 'Failed to update user.';
        return;
      }

      await invalidateAll();
      closeModal();
    } catch {
      modalError = 'An unexpected error occurred.';
    } finally {
      isSaving = false;
    }
  }

  async function deleteUser() {
    if (!editingUser) return;
    isDeleting = true;
    modalError = '';

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'DELETE'
      });

      const result = await res.json();

      if (!res.ok) {
        modalError = result.error || 'Failed to delete user.';
        return;
      }

      await invalidateAll();
      closeModal();
    } catch {
      modalError = 'An unexpected error occurred.';
    } finally {
      isDeleting = false;
    }
  }

  async function resetProgress(languageId: string) {
    if (!editingUser) return;
    if (
      !(await modal.confirm(
        'Are you sure you want to reset all progress for this language? This cannot be undone.'
      ))
    )
      return;

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}/reset-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languageId })
      });

      if (res.ok) {
        await invalidateAll();
        await modal.alert('Progress reset successfully.');
      } else {
        const data = await res.json();
        await modal.alert(data.error || 'Failed to reset progress.');
      }
    } catch (_) {
      await modal.alert('An error occurred.');
    }
  }

  async function approveVocab(vocabId: string) {
    try {
      const res = await fetch(`/api/admin/vocabulary/${vocabId}/approve`, { method: 'PUT' });
      if (res.ok) {
        await invalidateAll();
      } else {
        await modal.alert('Failed to approve vocabulary.');
      }
    } catch {
      await modal.alert('An error occurred.');
    }
  }

  async function deleteVocab(vocabId: string) {
    if (!(await modal.confirm('Are you sure you want to delete this auto-generated vocabulary?')))
      return;
    try {
      const res = await fetch(`/api/admin/vocabulary/${vocabId}`, { method: 'DELETE' });
      if (res.ok) {
        await invalidateAll();
      } else {
        await modal.alert('Failed to delete vocabulary.');
      }
    } catch {
      await modal.alert('An error occurred.');
    }
  }

  async function deleteClass(classId: string) {
    if (
      !(await modal.confirm('Are you sure you want to delete this class? This cannot be undone.'))
    )
      return;
    try {
      const res = await fetch(`/api/admin/classes/${classId}`, { method: 'DELETE' });
      if (res.ok) {
        await invalidateAll();
      } else {
        await modal.alert('Failed to delete class.');
      }
    } catch {
      await modal.alert('An error occurred.');
    }
  }

  // Batch import state
  let batchLanguageId = $state('');
  let batchText = $state('');
  let batchImporting = $state(false);
  let batchResult = $state<any>(null);

  async function runBatchImport() {
    if (!batchLanguageId || !batchText.trim()) return;
    batchImporting = true;
    batchResult = null;

    const lang = data.languages.find((l: any) => l.id === batchLanguageId);

    try {
      const res = await fetch('/api/admin/vocabulary/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: batchText,
          languageId: batchLanguageId,
          languageName: lang?.name ?? ''
        })
      });
      batchResult = await res.json();
    } catch (e) {
      batchResult = { error: 'Network error' };
    } finally {
      batchImporting = false;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="page-shell wide">
  <PageHeader title="Admin Dashboard" subtitle="Manage users and system configuration." />

  <section class="stats-card" in:fly={{ y: 20, duration: 400, delay: 100 }}>
    <h2>System Statistics</h2>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">Total Users</span>
        <span class="stat-value">{data.stats.totalUsers}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Active Users (30d)</span>
        <span class="stat-value">{data.stats.activeUsers}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Classes</span>
        <span class="stat-value">{data.stats.totalClasses}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Vocab Words</span>
        <span class="stat-value">{data.stats.totalVocabWords}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pending Vocab</span>
        <span class="stat-value">{data.stats.pendingVocabWords}</span>
      </div>
    </div>
  </section>

  <section class="health-panel" in:fly={{ y: 20, duration: 400, delay: 120 }}>
    <h2>System Health</h2>
    <div class="health-grid">
      <div class="health-card">
        <h3>User Stats</h3>
        <div class="health-items">
          <div class="health-row">
            <span class="health-label">Total Users</span>
            <span class="health-value">{data.systemHealth.userStats.total.toLocaleString()}</span>
          </div>
          <div class="health-row">
            <span class="health-label">Active (24h)</span>
            <span class="health-value"
              >{data.systemHealth.userStats.active24h.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Active (7d)</span>
            <span class="health-value">{data.systemHealth.userStats.active7d.toLocaleString()}</span
            >
          </div>
        </div>
      </div>

      <div class="health-card">
        <h3>Content Stats</h3>
        <div class="health-items">
          <div class="health-row">
            <span class="health-label">Vocabulary Words</span>
            <span class="health-value"
              >{data.systemHealth.contentStats.vocabularyWords.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Grammar Rules</span>
            <span class="health-value"
              >{data.systemHealth.contentStats.grammarRules.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Games Published</span>
            <span class="health-value"
              >{data.systemHealth.contentStats.gamesPublished.toLocaleString()}</span
            >
          </div>
        </div>
      </div>

      <div class="health-card">
        <h3>AI Usage (Today)</h3>
        <div class="health-items">
          <div class="health-row">
            <span class="health-label">Tokens Used</span>
            <span class="health-value"
              >{data.systemHealth.aiUsage.tokensUsedToday.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Good-Will Tokens</span>
            <span class="health-value"
              >{data.systemHealth.aiUsage.goodWillTokensToday.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Active AI Users</span>
            <span class="health-value"
              >{data.systemHealth.aiUsage.usersActiveToday.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Over Quota</span>
            <span
              class="health-value"
              class:health-warning={data.systemHealth.aiUsage.usersOverQuota > 0}
            >
              {data.systemHealth.aiUsage.usersOverQuota}
            </span>
          </div>
          <div class="health-row">
            <span class="health-label">Daily Quota Limit</span>
            <span class="health-value health-muted"
              >{data.systemHealth.aiUsage.dailyQuotaLimit.toLocaleString()}</span
            >
          </div>
        </div>
      </div>

      <div class="health-card">
        <h3>Database Size</h3>
        <div class="health-items">
          <div class="health-row">
            <span class="health-label">UserVocabulary</span>
            <span class="health-value"
              >{data.systemHealth.databaseSize.userVocabulary.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">UserVocabularyProgress</span>
            <span class="health-value"
              >{data.systemHealth.databaseSize.userVocabularyProgress.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">ReviewLog</span>
            <span class="health-value"
              >{data.systemHealth.databaseSize.reviewLog.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">ConversationSession</span>
            <span class="health-value"
              >{data.systemHealth.databaseSize.conversationSession.toLocaleString()}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">Message</span>
            <span class="health-value"
              >{data.systemHealth.databaseSize.message.toLocaleString()}</span
            >
          </div>
        </div>
      </div>

      <div class="health-card">
        <h3>System Config</h3>
        <div class="health-items">
          <div class="health-row">
            <span class="health-label">LLM Endpoint</span>
            <span class="health-value health-mono"
              >{data.systemHealth.systemConfig.llmEndpoint}</span
            >
          </div>
          <div class="health-row">
            <span class="health-label">LLM Model</span>
            <span class="health-value health-mono">{data.systemHealth.systemConfig.llmModel}</span>
          </div>
          <div class="health-row">
            <span class="health-label">Local Login</span>
            <span class="health-value">
              {#if data.systemHealth.systemConfig.localLoginEnabled}
                <span class="health-badge health-badge-on">Enabled</span>
              {:else}
                <span class="health-badge health-badge-off">Disabled</span>
              {/if}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="seed-card" in:fly={{ y: 20, duration: 400, delay: 150 }}>
    <div class="seed-info">
      <h2>Vocabulary Seed</h2>
      <p>
        Run the vocabulary and grammar rules seed script to update the database with the latest
        entries.
      </p>
    </div>
    <form
      method="POST"
      action="?/runSeed"
      use:enhance={() => {
        isRunningSeed = true;
        return async ({ update }) => {
          await update();
          isRunningSeed = false;
        };
      }}
    >
      <button type="submit" class="seed-btn" disabled={isRunningSeed}>
        {#if isRunningSeed}
          Running...
        {:else}
          Run Seed Script
        {/if}
      </button>
    </form>
  </section>

  <section class="seed-card" in:fly={{ y: 20, duration: 400, delay: 200 }}>
    <div class="seed-info">
      <h2>Local Login</h2>
      <p>
        {#if data.localLoginEnabled}
          Local (email/password) login and signup are currently <strong>enabled</strong>.
        {:else}
          Local (email/password) login and signup are currently <strong>disabled</strong>. Only
          OAuth sign-in is available.
        {/if}
      </p>
    </div>
    <form method="POST" action="?/toggleLocalLogin" use:enhance>
      <button type="submit" class="seed-btn" class:toggle-off={data.localLoginEnabled}>
        {#if data.localLoginEnabled}
          Disable
        {:else}
          Enable
        {/if}
      </button>
    </form>
  </section>

  <section
    class="seed-card"
    style="flex-direction: column; align-items: stretch; gap: 1rem;"
    in:fly={{ y: 20, duration: 400, delay: 250 }}
  >
    <div class="seed-info">
      <h2>LLM Configuration</h2>
      <p>
        Configure the language model used for AI features (e.g. vocabulary generation, onboarding,
        chat). The endpoint must be OpenAI-compatible.
      </p>
    </div>

    <form
      method="POST"
      action="?/updateLLMSettings"
      use:enhance={() => {
        llmMsg = '';
        llmError = false;
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success' || result.type === 'redirect') {
            llmMsg = 'LLM settings updated successfully.';
            llmError = false;
          } else {
            llmMsg = 'Failed to update LLM settings.';
            llmError = true;
          }
        };
      }}
      style="display: flex; flex-direction: column; gap: 1rem;"
    >
      <div class="form-group" style="margin-bottom: 0;">
        <label for="llmEndpoint">LLM API Endpoint (e.g., http://localhost:11434/v1)</label>
        <div style="display: flex; gap: 0.5rem;">
          <input
            type="text"
            id="llmEndpoint"
            name="llmEndpoint"
            bind:value={llmEndpoint}
            placeholder="https://api.openai.com/v1"
            style="flex: 1;"
          />
          <button
            type="button"
            class="cancel-btn"
            onclick={fetchModels}
            disabled={isFetchingModels || !llmEndpoint}
          >
            {isFetchingModels ? 'Fetching...' : 'Fetch Models'}
          </button>
        </div>
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label for="llmApiKey">API Key (Optional depending on provider)</label>
        <input
          type="password"
          id="llmApiKey"
          name="llmApiKey"
          bind:value={llmApiKey}
          placeholder="sk-..."
        />
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label for="llmModel">Model Name</label>
        {#if availableModels.length > 0}
          <select id="llmModel" name="llmModel" bind:value={llmModel}>
            <option value="" disabled>Select a model</option>
            {#each availableModels as model}
              <option value={model}>{model}</option>
            {/each}
          </select>
        {:else}
          <input
            type="text"
            id="llmModel"
            name="llmModel"
            bind:value={llmModel}
            placeholder="e.g., gpt-4o-mini"
          />
        {/if}
      </div>

      <div style="align-self: flex-end;">
        <button type="submit" class="save-btn">Save LLM Settings</button>
      </div>
    </form>

    {#if llmMsg}
      <div
        class="alert"
        class:alert-success={!llmError}
        class:alert-error={llmError}
        style="margin-top: 1rem; margin-bottom: 0;"
      >
        {llmMsg}
      </div>
    {/if}
  </section>

  {#if form?.success && !form.message?.includes('LLM')}
    <div class="alert alert-success">
      <span>{form.message}</span>
    </div>
  {/if}
  {#if form?.message && !form.success && !form.message?.includes('LLM')}
    <div class="alert alert-error">
      <span>{form.message}</span>
    </div>
  {/if}

  <section class="lang-data-card" in:fly={{ y: 20, duration: 400, delay: 300 }}>
    <h2>Language Data</h2>
    <p class="lang-data-desc">
      Export a full JSON snapshot of vocabulary and grammar rules for any language — copy it into
      your seed scripts for source control. Import a JSON file to upsert entries into the database.
    </p>

    <div class="lang-bulk-exports">
      <div class="lang-action-group">
        <span class="lang-action-label">All languages</span>
        <button class="seed-btn" onclick={exportAllLangData} disabled={isExportingAll}>
          {isExportingAll ? 'Exporting…' : 'Export'}
        </button>
        {#if !showImportAllConfirm}
          <div class="lang-import-row">
            <input type="file" accept=".json" bind:files={importAllFile} class="file-input" />
            <button
              class="seed-btn"
              onclick={() => (showImportAllConfirm = true)}
              disabled={!importAllFile?.length}
            >
              Import…
            </button>
          </div>
        {:else}
          <div class="delete-confirm">
            <span class="delete-warning"
              >Upsert vocab + grammar for all languages from this file?</span
            >
            <button
              class="delete-confirm-btn"
              onclick={importAllLangData}
              disabled={isImportingAll}
            >
              {isImportingAll ? 'Importing…' : 'Confirm'}
            </button>
            <button class="cancel-delete-btn" onclick={() => (showImportAllConfirm = false)}>
              Cancel
            </button>
          </div>
        {/if}
      </div>

      <div class="lang-action-group">
        <span class="lang-action-label">Everything</span>
        <button
          class="seed-btn seed-btn-full"
          onclick={exportEverything}
          disabled={isExportingFull}
        >
          {isExportingFull ? 'Exporting…' : 'Export'}
        </button>
        {#if !showImportFullConfirm}
          <div class="lang-import-row">
            <input type="file" accept=".json" bind:files={importFullFile} class="file-input" />
            <button
              class="seed-btn seed-btn-full"
              onclick={() => (showImportFullConfirm = true)}
              disabled={!importFullFile?.length}
            >
              Import…
            </button>
          </div>
        {:else}
          <div class="delete-confirm">
            <span class="delete-warning"
              >Import language data, users, and classes from this file? Existing records will be
              updated.</span
            >
            <button class="delete-confirm-btn" onclick={importFullData} disabled={isImportingFull}>
              {isImportingFull ? 'Importing…' : 'Confirm'}
            </button>
            <button class="cancel-delete-btn" onclick={() => (showImportFullConfirm = false)}>
              Cancel
            </button>
          </div>
        {/if}
      </div>
    </div>

    <div class="lang-data-controls">
      <div class="form-group mb-0">
        <label for="lang-select">Language</label>
        <select id="lang-select" bind:value={selectedLangId}>
          <option value="" disabled>Select a language…</option>
          {#each data.languages as lang}
            <option value={lang.id}
              >{lang.flag}
              {lang.name} — {(lang as any)._count.vocabularies} vocab, {(lang as any)._count
                .grammarRules} grammar rules</option
            >
          {/each}
        </select>
      </div>
    </div>

    {#if selectedLangId}
      <div class="lang-data-actions">
        <div class="lang-action-group">
          <span class="lang-action-label">Export</span>
          <button class="seed-btn" onclick={exportLangData} disabled={isExporting}>
            {isExporting ? 'Exporting…' : 'Download JSON'}
          </button>
        </div>

        <div class="lang-action-group">
          <span class="lang-action-label">Import (upsert)</span>
          <div class="lang-import-row">
            <input type="file" accept=".json" bind:files={importFile} class="file-input" />
            <button
              class="seed-btn"
              onclick={importLangData}
              disabled={isImporting || !importFile?.length}
            >
              {isImporting ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>

        <div class="lang-action-group">
          <span class="lang-action-label">Clear data</span>
          {#if !showDeleteLangConfirm}
            <div class="lang-import-row">
              <select bind:value={deleteScope} class="scope-select">
                <option value="vocab">Vocabulary only</option>
                <option value="grammar">Grammar only</option>
                <option value="all">All (vocab + grammar)</option>
              </select>
              <button class="delete-btn" onclick={() => (showDeleteLangConfirm = true)}
                >Delete…</button
              >
            </div>
          {:else}
            <div class="delete-confirm">
              <span class="delete-warning"
                >Delete all {deleteScope === 'all' ? 'vocab + grammar' : deleteScope} for {selectedLang?.name}?</span
              >
              <button
                class="delete-confirm-btn"
                onclick={deleteLangData}
                disabled={isDeletingLangData}
              >
                {isDeletingLangData ? 'Deleting…' : 'Confirm'}
              </button>
              <button class="cancel-delete-btn" onclick={() => (showDeleteLangConfirm = false)}
                >Cancel</button
              >
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if langDataMsg}
      <div
        class="alert"
        class:alert-success={!langDataError}
        class:alert-error={langDataError}
        style="margin: 1rem 0 0 0;"
      >
        {langDataMsg}
      </div>
    {/if}
  </section>

  <section class="admin-section" in:fly={{ y: 20, duration: 400, delay: 340 }}>
    <h2>Batch Word Import</h2>
    <p class="section-desc">
      Paste any text or essay. The system will extract vocabulary, enrich with AI, and auto-review
      for safety.
    </p>

    <div class="batch-import-form">
      <div class="form-row">
        <label for="batch-language">Target Language</label>
        <select id="batch-language" bind:value={batchLanguageId}>
          <option value="">Select language...</option>
          {#each data.languages as lang}
            <option value={lang.id}>{lang.name} ({lang.flag})</option>
          {/each}
        </select>
      </div>

      <div class="form-row">
        <label for="batch-text">Text to Import</label>
        <textarea
          id="batch-text"
          bind:value={batchText}
          placeholder="Paste an essay, article, or list of words here..."
          rows="8"
        ></textarea>
      </div>

      <button
        type="button"
        class="btn-admin-primary"
        onclick={runBatchImport}
        disabled={batchImporting || !batchLanguageId || !batchText.trim()}
      >
        {batchImporting ? 'Processing...' : 'Import & Auto-Review'}
      </button>

      {#if batchResult}
        <div class="batch-result" class:batch-result-error={batchResult.error}>
          {#if batchResult.error}
            <p>Error: {batchResult.error}</p>
          {:else}
            <p>&#10003; <strong>{batchResult.extracted}</strong> unique words extracted</p>
            <p>&#10003; <strong>{batchResult.alreadyInDb}</strong> already in database</p>
            <p>&#10003; <strong>{batchResult.enriched}</strong> new words enriched by AI</p>
            <p>
              &#10003; <strong>{batchResult.approved}</strong> approved,
              <strong>{batchResult.rejected}</strong> rejected by safety review
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <section class="pending-vocab-card" in:fly={{ y: 20, duration: 400, delay: 350 }}>
    <div
      style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;"
    >
      <h2 style="margin: 0;">Auto-Generated Vocabulary</h2>
      <button
        class="seed-btn"
        onclick={runAICheckAll}
        disabled={isCheckingAI || data.pendingVocab.length === 0}
        style="background-color: #8b5cf6;"
      >
        {isCheckingAI ? aiCheckProgress || 'Checking...' : 'AI Check All'}
      </button>
    </div>
    <p class="lang-data-desc">
      Review vocabulary generated by the LLM before finalizing it in the database.
    </p>

    {#if aiCheckResult}
      <div class="alert alert-success" style="margin-bottom: 1rem; padding: 0.75rem;">
        {aiCheckResult}
      </div>
    {/if}

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Language</th>
            <th>Lemma</th>
            <th>Meaning</th>
            <th>POS</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if data.pendingVocab.length === 0}
            <tr>
              <td colspan="6" style="text-align: center; padding: 2rem;">No pending vocabulary.</td>
            </tr>
          {:else}
            {#each data.pendingVocab as vocab}
              <tr>
                <td>{vocab.language?.flag} {vocab.language?.name}</td>
                <td>{vocab.lemma}</td>
                <td>{(vocab as any).meanings?.[0]?.value || '—'}</td>
                <td>{vocab.partOfSpeech || '—'}</td>
                <td>{new Date(vocab.createdAt).toLocaleDateString()}</td>
                <td>
                  <div style="display: flex; gap: 0.5rem;">
                    <button class="approve-btn" onclick={() => approveVocab(vocab.id)}
                      >Approve</button
                    >
                    <button class="delete-vocab-btn" onclick={() => deleteVocab(vocab.id)}
                      >Delete</button
                    >
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </section>

  <section class="classes-section" in:fly={{ y: 20, duration: 400, delay: 400 }}>
    <h2>Class & Community Management</h2>
    <p class="lang-data-desc">Manage existing classes and delete empty or abandoned classes.</p>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Language</th>
            <th>Members</th>
            <th>Assignments</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#if data.classes.length === 0}
            <tr>
              <td colspan="7" style="text-align: center; padding: 2rem;">No classes found.</td>
            </tr>
          {:else}
            {#each data.classes as cls}
              <tr>
                <td class="id-cell">{cls.id}</td>
                <td>{cls.name}</td>
                <td>{cls.primaryLanguage}</td>
                <td>{cls._count.members}</td>
                <td>{cls._count.assignments}</td>
                <td>{new Date(cls.createdAt).toLocaleDateString()}</td>
                <td>
                  <button class="delete-vocab-btn" onclick={() => deleteClass(cls.id)}
                    >Delete</button
                  >
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </section>

  <section class="users-section" in:fly={{ y: 20, duration: 400, delay: 450 }}>
    <h2>Users</h2>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>CEFR Level</th>
            <th>Created At</th>
            <th>Last Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.users as user}
            <tr>
              <td class="id-cell">{user.id}</td>
              <td>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  {#if new Date().getTime() - new Date(user.lastActive).getTime() < 24 * 60 * 60 * 1000}
                    <span class="active-indicator" title="Active recently"></span>
                  {/if}
                  {user.username}
                </div>
              </td>
              <td>{user.email || 'N/A'}</td>
              <td>
                <span class="role-badge" class:role-admin={user.role === 'ADMIN'}>{user.role}</span>
              </td>
              <td>
                {user.progress?.find((p) => p.languageId === user.activeLanguage?.id)?.cefrLevel ||
                  'A1'}
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td>
                {new Date(user.lastActive).toLocaleDateString()}<br />
                <span style="font-size: 0.85em; color: #6b7280;"
                  >{new Date(user.lastActive).toLocaleTimeString()}</span
                >
              </td>
              <td>
                <button class="edit-btn" onclick={() => openEditModal(user)}>Edit</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
</div>

{#if editingUser}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={handleBackdropClick}>
    <div class="modal">
      <div class="modal-header">
        <h2>Edit User</h2>
        <button class="modal-close" onclick={closeModal}>&times;</button>
      </div>

      {#if modalError}
        <div class="alert alert-error modal-alert">
          <span>{modalError}</span>
        </div>
      {/if}

      <form
        class="modal-form"
        onsubmit={(e) => {
          e.preventDefault();
          saveUser();
        }}
      >
        <div class="form-group">
          <label for="edit-username">Username</label>
          <input id="edit-username" type="text" bind:value={editingUser.username} required />
        </div>

        <div class="form-group">
          <label for="edit-email">Email</label>
          <input id="edit-email" type="email" bind:value={editingUser.email} required />
        </div>

        <div class="form-group">
          <label for="edit-role">Role</label>
          <select id="edit-role" bind:value={editingUser.role}>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        {#if editingUser.progress && editingUser.progress.length > 0}
          <div class="progress-section">
            <h3>Language Progress</h3>
            {#each editingUser.progress as prog}
              <div class="progress-row">
                <div class="progress-lang">{prog.languageName}</div>
                <div class="form-group mb-0">
                  <label for={`cefr-${prog.languageId}`} class="sr-only">CEFR Level</label>
                  <select id={`cefr-${prog.languageId}`} bind:value={prog.cefrLevel}>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                </div>
                <div class="form-group mb-0 checkbox-group">
                  <label>
                    <input type="checkbox" bind:checked={prog.hasOnboarded} />
                    Onboarded
                  </label>
                </div>
                <button
                  type="button"
                  class="cancel-delete-btn"
                  style="padding: 0.3rem 0.5rem; font-size: 0.75rem;"
                  onclick={() => resetProgress(prog.languageId)}
                >
                  Reset Progress
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <div class="modal-actions">
          {#if !showDeleteConfirm}
            <button type="button" class="delete-btn" onclick={() => (showDeleteConfirm = true)}>
              Delete User
            </button>
          {:else}
            <div class="delete-confirm">
              <span class="delete-warning">Are you sure?</span>
              <button
                type="button"
                class="delete-confirm-btn"
                onclick={deleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                type="button"
                class="cancel-delete-btn"
                onclick={() => (showDeleteConfirm = false)}
              >
                Cancel
              </button>
            </div>
          {/if}

          <div class="modal-right-actions">
            <button type="button" class="cancel-btn" onclick={closeModal}>Cancel</button>
            <button type="submit" class="save-btn" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .active-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    background-color: #22c55e;
    border-radius: 50%;
  }

  .stats-card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .stats-card h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #111827);
    margin: 0 0 1rem 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .stat-item {
    background: var(--card-bg, #f9fafb);
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--card-border, #e5e7eb);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-color, #111827);
  }

  .seed-card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  .seed-info h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #111827);
    margin: 0 0 0.25rem 0;
  }

  .seed-info p {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
  }

  .seed-btn {
    background-color: #22c55e;
    color: white;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
  }

  .seed-btn:hover {
    background-color: #16a34a;
  }

  .seed-btn:disabled {
    background-color: #93c5fd;
    cursor: not-allowed;
  }

  .toggle-off {
    background-color: #ef4444;
  }

  .toggle-off:hover {
    background-color: #dc2626;
  }

  .alert {
    padding: 1rem 1.25rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .alert-success {
    background-color: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .alert-error {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .users-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #111827);
    margin: 0 0 1rem 0;
  }

  .table-wrapper {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  thead {
    background-color: var(--header-bg, #f9fafb);
  }

  th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: var(--text-color, #374151);
    border-bottom: 1px solid var(--card-border, #e5e7eb);
  }

  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--card-border, #f3f4f6);
    color: var(--text-color, #4b5563);
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background-color: var(--link-hover-bg, #f9fafb);
  }

  .id-cell {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8rem;
    color: #6b7280;
  }

  .role-badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    background-color: #f3f4f6;
    color: #6b7280;
  }

  .role-admin {
    background-color: #ede9fe;
    color: #7c3aed;
  }

  .edit-btn {
    background: none;
    border: 1px solid #d1d5db;
    padding: 0.3rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.15s;
  }

  .edit-btn:hover {
    background-color: #f3f4f6;
    border-color: #9ca3af;
    color: #111827;
  }

  /* Modal styles */
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
    padding: 1rem;
  }

  .modal {
    background: var(--card-bg, #ffffff);
    border-radius: 0.75rem;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  .modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #9ca3af;
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .modal-close:hover {
    color: #4b5563;
  }

  .modal-alert {
    margin: 1rem 1.5rem 0;
  }

  .modal-form {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.35rem;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: var(--input-text, #111827);
    background: var(--input-bg, #ffffff);
    transition: border-color 0.15s;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  /* removed unused css selector */

  .modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e5e7eb;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .modal-right-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  .save-btn {
    background-color: #22c55e;
    color: white;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .save-btn:hover {
    background-color: #16a34a;
  }

  .save-btn:disabled {
    background-color: #93c5fd;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: none;
    border: 1px solid #d1d5db;
    padding: 0.5rem 1.25rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }

  .delete-btn {
    background: none;
    border: 1px solid #fecaca;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: #dc2626;
    cursor: pointer;
    transition: all 0.15s;
  }

  .delete-btn:hover {
    background-color: #fef2f2;
    border-color: #f87171;
  }

  .delete-confirm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .delete-warning {
    font-size: 0.8rem;
    color: #dc2626;
    font-weight: 500;
  }

  .delete-confirm-btn {
    background-color: #dc2626;
    color: white;
    border: none;
    padding: 0.4rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .delete-confirm-btn:hover {
    background-color: #b91c1c;
  }

  .delete-confirm-btn:disabled {
    background-color: #fca5a5;
    cursor: not-allowed;
  }

  .cancel-delete-btn {
    background: none;
    border: 1px solid #d1d5db;
    padding: 0.4rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    color: #6b7280;
    cursor: pointer;
  }

  .cancel-delete-btn:hover {
    background-color: #f9fafb;
  }

  .progress-section {
    margin-top: 1rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  .progress-section h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.75rem 0;
  }

  .progress-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    border: 1px solid #e5e7eb;
  }

  .progress-lang {
    flex: 1;
    font-weight: 500;
    color: #111827;
    font-size: 0.875rem;
  }

  .delete-vocab-btn {
    background: none;
    border: 1px solid #fecaca;
    padding: 0.3rem 0.6rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #dc2626;
    cursor: pointer;
    transition: all 0.15s;
  }

  .delete-vocab-btn:hover {
    background-color: #fef2f2;
    border-color: #f87171;
  }

  .approve-btn {
    background: none;
    border: 1px solid #a7f3d0;
    padding: 0.3rem 0.6rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #059669;
    cursor: pointer;
    transition: all 0.15s;
  }

  .approve-btn:hover {
    background-color: #ecfdf5;
    border-color: #34d399;
  }

  .pending-vocab-card,
  .classes-section {
    margin-bottom: 2rem;
  }

  .lang-data-card {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .lang-data-card h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #111827);
    margin: 0 0 0.4rem 0;
  }

  .lang-data-desc {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0 0 1.25rem 0;
  }

  .lang-bulk-exports {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-bottom: 1.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--card-border, #e5e7eb);
  }

  .seed-btn-full {
    background-color: #0f766e;
  }

  .seed-btn-full:hover:not(:disabled) {
    background-color: #0d6b63;
  }

  .lang-data-controls {
    max-width: 480px;
    margin-bottom: 1.25rem;
  }

  .lang-data-actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--card-border, #e5e7eb);
  }

  .lang-action-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .lang-action-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #374151;
    width: 110px;
    flex-shrink: 0;
  }

  .lang-import-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .file-input {
    font-size: 0.8rem;
    color: var(--text-color, #374151);
    cursor: pointer;
  }

  .scope-select {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--input-border, #d1d5db);
    border-radius: 0.375rem;
    font-size: 0.8rem;
    color: var(--input-text, #374151);
    background: var(--input-bg, #fff);
    cursor: pointer;
  }

  .mb-0 {
    margin-bottom: 0 !important;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: normal;
    margin-bottom: 0;
    cursor: pointer;
  }

  .checkbox-group input[type='checkbox'] {
    width: auto;
    cursor: pointer;
  }

  /* System Health Panel */
  .health-panel {
    background: var(--card-bg, #ffffff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .health-panel h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color, #111827);
    margin: 0 0 1rem 0;
  }

  .health-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1rem;
  }

  .health-card {
    background: var(--card-bg, #f9fafb);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
  }

  .health-card h3 {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #6b7280);
    margin: 0 0 0.75rem 0;
  }

  .health-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .health-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .health-label {
    font-size: 0.825rem;
    color: var(--text-color, #4b5563);
  }

  .health-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-color, #111827);
    text-align: right;
  }

  .health-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    font-weight: 500;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .health-muted {
    color: var(--text-muted, #9ca3af);
    font-weight: 500;
  }

  .health-warning {
    color: #dc2626;
  }

  .health-badge {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .health-badge-on {
    background-color: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  .health-badge-off {
    background-color: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .admin-section {
    background: var(--card-bg, #fff);
    border: 1px solid var(--card-border, #e5e7eb);
    border-radius: 1rem;
    padding: 1.5rem 2rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }

  .admin-section h2 {
    margin: 0 0 0.35rem 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-color, #111827);
  }

  .section-desc {
    margin: 0 0 1.25rem 0;
    font-size: 0.875rem;
    color: var(--text-muted, #6b7280);
  }

  .batch-import-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 700px;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .form-row label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
  }

  .form-row select,
  .form-row textarea {
    padding: 0.625rem 0.875rem;
    border: 1.5px solid var(--card-border, #e5e7eb);
    border-radius: 0.625rem;
    font-family: inherit;
    font-size: 0.9rem;
    background: var(--card-bg);
    color: var(--text-color);
    resize: vertical;
  }

  .form-row textarea {
    min-height: 160px;
  }

  .btn-admin-primary {
    align-self: flex-start;
    padding: 0.625rem 1.5rem;
    background: #22c55e;
    color: white;
    border: none;
    border-radius: 0.75rem;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    box-shadow: 0 3px 0 #16a34a;
    transition: all 0.15s;
  }

  .btn-admin-primary:hover:not(:disabled) {
    background: #16a34a;
  }

  .btn-admin-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .batch-result {
    padding: 1rem;
    border-radius: 0.75rem;
    background: #f0fdf4;
    border: 1px solid #86efac;
    font-size: 0.875rem;
  }

  .batch-result-error {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .batch-result p {
    margin: 0.25rem 0;
  }
</style>
