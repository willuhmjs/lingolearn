<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import type { PageData, ActionData } from './$types';
	export let data: PageData;
	export let form: ActionData;

	let isRunningSeed = false;

	// Language data management state
	let selectedLangId = '';
	let isExporting = false;
	let isImporting = false;
	let importFile: FileList | undefined;
	let langDataMsg = '';
	let langDataError = false;
	let showDeleteLangConfirm = false;
	let deleteScope: 'vocab' | 'grammar' | 'all' = 'all';
	let isDeletingLangData = false;

	// LLM config state
	let llmEndpoint = data.llmEndpoint || '';
	let llmModel = data.llmModel || '';
	let availableModels: string[] = [];
	let isFetchingModels = false;
	let llmMsg = '';
	let llmError = false;

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

			const res = await fetch(fetchUrl);
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

	// Try fetching models on load if endpoint exists
	$: {
		if (data.llmEndpoint) {
			// Initialize
		}
	}
	
	// Svelte onMount is better for initial fetch to avoid SSR issues
	import { onMount } from 'svelte';
	onMount(() => {
		if (llmEndpoint) fetchModels();
	});

	$: selectedLang = data.languages.find((l: any) => l.id === selectedLangId);

	async function exportLangData() {
		if (!selectedLangId) return;
		isExporting = true;
		const res = await fetch(`/api/admin/language-data?languageId=${selectedLangId}`);
		isExporting = false;
		if (!res.ok) { langDataMsg = 'Export failed.'; langDataError = true; return; }
		const blob = await res.blob();
		const cd = res.headers.get('Content-Disposition') || '';
		const fnMatch = cd.match(/filename="([^"]+)"/);
		const filename = fnMatch ? fnMatch[1] : 'language-data.json';
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = filename; a.click();
		URL.revokeObjectURL(url);
		langDataMsg = `Exported ${filename}`;
		langDataError = false;
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
			if (!res.ok) { langDataMsg = result.error || 'Import failed.'; langDataError = true; }
			else {
				const v = result.vocab; const g = result.grammar;
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
		const res = await fetch(`/api/admin/language-data?languageId=${selectedLangId}&scope=${deleteScope}`, { method: 'DELETE' });
		const result = await res.json();
		isDeletingLangData = false;
		showDeleteLangConfirm = false;
		if (!res.ok) { langDataMsg = result.error || 'Delete failed.'; langDataError = true; }
		else {
			langDataMsg = `Deleted ${result.vocabDeleted} vocab + ${result.grammarDeleted} grammar entries.`;
			langDataError = false;
			await invalidateAll();
		}
	}

	// Modal state
	let editingUser: {
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
	} | null = null;

	let isSaving = false;
	let isDeleting = false;
	let modalError = '';
	let showDeleteConfirm = false;

	function openEditModal(user: typeof data.users[number]) {
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
		if (!confirm('Are you sure you want to reset all progress for this language? This cannot be undone.')) return;
		
		try {
			const res = await fetch(`/api/admin/users/${editingUser.id}/reset-progress`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ languageId })
			});

			if (res.ok) {
				await invalidateAll();
				alert('Progress reset successfully.');
			} else {
				const data = await res.json();
				alert(data.error || 'Failed to reset progress.');
			}
		} catch (error) {
			alert('An error occurred.');
		}
	}

	async function approveVocab(vocabId: string) {
		try {
			const res = await fetch(`/api/admin/vocabulary/${vocabId}/approve`, { method: 'PUT' });
			if (res.ok) {
				await invalidateAll();
			} else {
				alert('Failed to approve vocabulary.');
			}
		} catch {
			alert('An error occurred.');
		}
	}

	async function deleteVocab(vocabId: string) {
		if (!confirm('Are you sure you want to delete this auto-generated vocabulary?')) return;
		try {
			const res = await fetch(`/api/admin/vocabulary/${vocabId}`, { method: 'DELETE' });
			if (res.ok) {
				await invalidateAll();
			} else {
				alert('Failed to delete vocabulary.');
			}
		} catch {
			alert('An error occurred.');
		}
	}

	async function deleteClass(classId: string) {
		if (!confirm('Are you sure you want to delete this class? This cannot be undone.')) return;
		try {
			const res = await fetch(`/api/admin/classes/${classId}`, { method: 'DELETE' });
			if (res.ok) {
				await invalidateAll();
			} else {
				alert('Failed to delete class.');
			}
		} catch {
			alert('An error occurred.');
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="admin-container">
	<header class="admin-header" in:fly={{ y: 20, duration: 400 }}>
		<h1>Admin Dashboard</h1>
		<p>Manage users and system configuration.</p>
	</header>

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

	<section class="seed-card" in:fly={{ y: 20, duration: 400, delay: 150 }}>
		<div class="seed-info">
			<h2>Vocabulary Seed</h2>
			<p>Run the vocabulary and grammar rules seed script to update the database with the latest entries.</p>
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
					Local (email/password) login and signup are currently <strong>disabled</strong>. Only OAuth sign-in is available.
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

	<section class="seed-card" style="flex-direction: column; align-items: stretch; gap: 1rem;" in:fly={{ y: 20, duration: 400, delay: 250 }}>
		<div class="seed-info">
			<h2>LLM Configuration</h2>
			<p>Configure the language model used for AI features (e.g. vocabulary generation, onboarding, chat). The endpoint must be OpenAI-compatible.</p>
		</div>
		
		{#if llmMsg}
			<div class="alert" class:alert-success={!llmError} class:alert-error={llmError} style="margin: 0;">
				{llmMsg}
			</div>
		{/if}

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
					<button type="button" class="cancel-btn" on:click={fetchModels} disabled={isFetchingModels || !llmEndpoint}>
						{isFetchingModels ? 'Fetching...' : 'Fetch Models'}
					</button>
				</div>
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
	</section>

	{#if form?.success}
		<div class="alert alert-success">
			<span>{form.message}</span>
		</div>
	{/if}
	{#if form?.message && !form.success}
		<div class="alert alert-error">
			<span>{form.message}</span>
		</div>
	{/if}

	<section class="lang-data-card" in:fly={{ y: 20, duration: 400, delay: 300 }}>
		<h2>Language Data</h2>
		<p class="lang-data-desc">Export a full JSON snapshot of vocabulary and grammar rules for any language — copy it into your seed scripts for source control. Import a JSON file to upsert entries into the database.</p>

		<div class="lang-data-controls">
			<div class="form-group mb-0">
				<label for="lang-select">Language</label>
				<select id="lang-select" bind:value={selectedLangId}>
					<option value="" disabled>Select a language…</option>
					{#each data.languages as lang}
						<option value={lang.id}>{lang.flag} {lang.name} — {(lang as any)._count.vocabularies} vocab, {(lang as any)._count.grammarRules} grammar rules</option>
					{/each}
				</select>
			</div>
		</div>

		{#if selectedLangId}
			<div class="lang-data-actions">
				<div class="lang-action-group">
					<span class="lang-action-label">Export</span>
					<button class="seed-btn" on:click={exportLangData} disabled={isExporting}>
						{isExporting ? 'Exporting…' : 'Download JSON'}
					</button>
				</div>

				<div class="lang-action-group">
					<span class="lang-action-label">Import (upsert)</span>
					<div class="lang-import-row">
						<input type="file" accept=".json" bind:files={importFile} class="file-input" />
						<button class="seed-btn" on:click={importLangData} disabled={isImporting || !importFile?.length}>
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
							<button class="delete-btn" on:click={() => showDeleteLangConfirm = true}>Delete…</button>
						</div>
					{:else}
						<div class="delete-confirm">
							<span class="delete-warning">Delete all {deleteScope === 'all' ? 'vocab + grammar' : deleteScope} for {selectedLang?.name}?</span>
							<button class="delete-confirm-btn" on:click={deleteLangData} disabled={isDeletingLangData}>
								{isDeletingLangData ? 'Deleting…' : 'Confirm'}
							</button>
							<button class="cancel-delete-btn" on:click={() => showDeleteLangConfirm = false}>Cancel</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if langDataMsg}
			<div class="alert" class:alert-success={!langDataError} class:alert-error={langDataError} style="margin: 1rem 0 0 0;">
				{langDataMsg}
			</div>
		{/if}
	</section>

	<section class="pending-vocab-card" in:fly={{ y: 20, duration: 400, delay: 350 }}>
		<h2>Auto-Generated Vocabulary</h2>
		<p class="lang-data-desc">Review vocabulary generated by the LLM before finalizing it in the database.</p>
		
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
								<td>{vocab.meaning || '—'}</td>
								<td>{vocab.partOfSpeech || '—'}</td>
								<td>{new Date(vocab.createdAt).toLocaleDateString()}</td>
								<td>
									<div style="display: flex; gap: 0.5rem;">
										<button class="approve-btn" on:click={() => approveVocab(vocab.id)}>Approve</button>
										<button class="delete-vocab-btn" on:click={() => deleteVocab(vocab.id)}>Delete</button>
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
									<button class="delete-vocab-btn" on:click={() => deleteClass(cls.id)}>Delete</button>
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
								{user.progress?.find((p) => p.languageId === user.activeLanguage?.id)?.cefrLevel || 'A1'}
							</td>
							<td>{new Date(user.createdAt).toLocaleDateString()}</td>
							<td>
								{new Date(user.lastActive).toLocaleDateString()}<br />
								<span style="font-size: 0.85em; color: #6b7280;">{new Date(user.lastActive).toLocaleTimeString()}</span>
							</td>
							<td>
								<button class="edit-btn" on:click={() => openEditModal(user)}>Edit</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

{#if editingUser}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="modal-backdrop" on:click={handleBackdropClick}>
		<div class="modal">
			<div class="modal-header">
				<h2>Edit User</h2>
				<button class="modal-close" on:click={closeModal}>&times;</button>
			</div>

			{#if modalError}
				<div class="alert alert-error modal-alert">
					<span>{modalError}</span>
				</div>
			{/if}

			<form class="modal-form" on:submit|preventDefault={saveUser}>
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
								<button type="button" class="cancel-delete-btn" style="padding: 0.3rem 0.5rem; font-size: 0.75rem;" on:click={() => resetProgress(prog.languageId)}>
									Reset Progress
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<div class="modal-actions">
					{#if !showDeleteConfirm}
						<button type="button" class="delete-btn" on:click={() => (showDeleteConfirm = true)}>
							Delete User
						</button>
					{:else}
						<div class="delete-confirm">
							<span class="delete-warning">Are you sure?</span>
							<button type="button" class="delete-confirm-btn" on:click={deleteUser} disabled={isDeleting}>
								{isDeleting ? 'Deleting...' : 'Yes, Delete'}
							</button>
							<button type="button" class="cancel-delete-btn" on:click={() => (showDeleteConfirm = false)}>
								Cancel
							</button>
						</div>
					{/if}

					<div class="modal-right-actions">
						<button type="button" class="cancel-btn" on:click={closeModal}>Cancel</button>
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
	.admin-container {
		max-width: 1200px;
		margin: 0 auto;
		color: #334155;
	}

	.admin-header {
		margin-bottom: 2rem;
	}

	.admin-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-color, #111827);
		margin: 0 0 0.5rem 0;
	}

	.admin-header p {
		color: #6b7280;
		margin: 0;
	}

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
		background: #f9fafb;
		padding: 1rem;
		border-radius: 0.5rem;
		border: 1px solid #e5e7eb;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.stat-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
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

	.form-row {
		display: flex;
		gap: 1rem;
	}

	.form-row .form-group {
		flex: 1;
	}

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

	.checkbox-group input[type="checkbox"] {
		width: auto;
		cursor: pointer;
	}
</style>