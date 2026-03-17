<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast';
	import { invalidateAll } from '$app/navigation';

	let { data, form }: { data: PageData; form: any } = $props();

	// --- Tab state ---
	type Tab = 'overview' | 'account' | 'ai' | 'danger';
	let activeTab = $state<Tab>('overview');

	// --- Form submission states ---
	let isUpdatingUsername = $state(false);
	let isUpdatingLLM = $state(false);
	let isUpdatingPassword = $state(false);
	let isDeletingAccount = $state(false);

	// Username change
	let newUsername = $state('');
	let usernameSuggestion = $state<string | null>(null);
	$effect(() => {
		usernameSuggestion = (form as any)?.usernameSuggestion ?? null;
	});

	// Streak freeze
	let isBuyingFreeze = $state(false);
	let freezeCount = $state<number>(0);
	let freezeXp = $state<number>(0);
	$effect(() => {
		freezeCount = (data.user as any)?.streakFreezes ?? 0;
		freezeXp = (data.user as any)?.totalXp ?? 0;
	});

	async function buyStreakFreeze() {
		if (isBuyingFreeze) return;
		isBuyingFreeze = true;
		try {
			const res = await fetch('/api/user/streak-freeze', { method: 'POST' });
			const json = await res.json();
			if (res.ok) {
				freezeCount = json.streakFreezes;
				freezeXp = json.totalXp;
				toastSuccess('Streak freeze purchased!');
				invalidateAll();
			} else {
				toastError(json.error || 'Failed to buy streak freeze');
			}
		} catch {
			toastError('An error occurred');
		} finally {
			isBuyingFreeze = false;
		}
	}

	// LLM settings
	let llmBaseUrl = $state('');
	let llmApiKey = $state('');
	let llmModel = $state('');
	$effect(() => {
		llmBaseUrl = data.user?.llmBaseUrl ?? '';
		llmApiKey = data.user?.llmApiKey ?? '';
		llmModel = data.user?.llmModel ?? '';
	});

	// FSRS retention
	let fsrsRetention = $state(0.9);
	let isUpdatingFsrs = $state(false);
	$effect(() => {
		fsrsRetention = (data.user as any)?.fsrsRetention ?? 0.9;
	});
	$effect(() => {
		if ((form as any)?.fsrsRetentionSuccess) toastSuccess((form as any).fsrsRetentionSuccess);
		if ((form as any)?.fsrsRetentionError) toastError((form as any).fsrsRetentionError);
	});
	let availableModels = $state<string[]>([]);
	let isFetchingModels = $state(false);

	// Account deletion confirmation
	let deleteConfirmation = $state('');
	let canDelete = $derived(deleteConfirmation === 'DELETE');

	// Toast effects
	$effect(() => {
		if ((form as any)?.usernameSuccess) toastSuccess((form as any).usernameSuccess);
		if (form?.llmSuccess) toastSuccess(form.llmSuccess);
		if (form?.passwordSuccess) toastSuccess(form.passwordSuccess);
		if (form?.languageSuccess) toastSuccess(form.languageSuccess);
		if ((form as any)?.usernameError && !(form as any)?.usernameSuggestion)
			toastError((form as any).usernameError);
		if (form?.llmError) toastError(form.llmError);
		if (form?.passwordError) toastError(form.passwordError);
		if (form?.languageError) toastError(form.languageError);
	});

	let fetchModelsController: AbortController | null = null;

	async function fetchModels() {
		if (!llmBaseUrl) {
			availableModels = [];
			return;
		}
		fetchModelsController?.abort();
		fetchModelsController = new AbortController();
		isFetchingModels = true;
		try {
			let fetchUrl = llmBaseUrl;
			if (!fetchUrl.endsWith('/v1/models') && !fetchUrl.endsWith('/v1/models/')) {
				fetchUrl = fetchUrl.replace(/\/+$/, '') + '/v1/models';
			}
			const headers: Record<string, string> = {};
			if (llmApiKey) headers['Authorization'] = `Bearer ${llmApiKey}`;
			const res = await fetch(fetchUrl, { headers, signal: fetchModelsController.signal });
			if (res.ok) {
				const d = await res.json();
				if (d?.data && Array.isArray(d.data)) availableModels = d.data.map((m: any) => m.id);
				else if (Array.isArray(d)) availableModels = d.map((m: any) => m.id || m);
				else availableModels = [];
			} else {
				availableModels = [];
			}
		} catch (error: any) {
			if (error.name === 'AbortError') return;
			availableModels = [];
		} finally {
			isFetchingModels = false;
		}
	}

	onMount(() => {
		if (llmBaseUrl) fetchModels();
	});

	// AI quota helpers
	const quotaPct = $derived(
		Math.min(100, (data.aiUsage.effectiveUsage / data.aiUsage.dailyQuota) * 100)
	);
	const quotaColor = $derived(quotaPct >= 90 ? '#ef4444' : quotaPct >= 70 ? '#f59e0b' : '#22c55e');

	function fmtTokens(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return n.toString();
	}
</script>

<div class="profile-container">
	<header class="profile-header" in:fly={{ y: 20, duration: 400 }}>
		<h1>Profile</h1>
	</header>

	<!-- Tab bar -->
	<nav class="tab-bar" in:fly={{ y: 20, duration: 400, delay: 60 }}>
		{#each [{ id: 'overview', label: 'Overview' }, { id: 'account', label: 'Account' }, { id: 'ai', label: 'AI / LLM' }, { id: 'danger', label: 'Danger' }] as { id: Tab; label: string }[] as tab}
			<button
				class="tab-btn"
				class:active={activeTab === tab.id}
				class:danger-tab={tab.id === 'danger'}
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	<!-- OVERVIEW TAB -->
	{#if activeTab === 'overview'}
		<div in:fly={{ y: 16, duration: 300 }}>
			<!-- User info -->
			<section class="card">
				<div class="username-row">
					<span class="username-display">{data.user?.username}</span>
					{#if data.user?.role === 'admin'}
						<span class="admin-badge" title="Administrator">
							<svg
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-label="Admin"
								width="18"
								height="18"
							>
								<path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" />
							</svg>
						</span>
					{/if}
				</div>
			</section>

			<!-- Language progress cards -->
			{#if data.languageProgress.length > 0}
				<section class="card lang-progress-card">
					<h2>Languages</h2>
					<div class="lang-cards">
						{#each data.languageProgress as lp}
							<div class="lang-card">
								<div class="lang-card-header">
									<span class="lang-flag">{lp.flag}</span>
									<span class="lang-name">{lp.languageName}</span>
									<span class="level-badge">{lp.cefrLevel}</span>
								</div>
								<div class="lang-progress-bar-wrap">
									<div class="lang-progress-bar-track">
										<div
											class="lang-progress-bar-fill"
											style="width: {lp.cefrProgress.percentComplete}%;"
										></div>
									</div>
									<span class="lang-progress-pct">{lp.cefrProgress.percentComplete}%</span>
								</div>
								{#if lp.cefrProgress.nextLevel}
									<p class="lang-next-level">toward {lp.cefrProgress.nextLevel}</p>
								{:else}
									<p class="lang-next-level">Max level reached</p>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- AI Quota -->
			{#if !data.user?.useLocalLlm}
				<section class="card quota-card">
					<h2>Daily AI Usage</h2>
					<p class="quota-desc">
						Tokens are consumed by AI features (lessons, chat, grammar tests). Words you look up
						that get saved to the shared dictionary are refunded as good-will tokens.
					</p>
					<div class="quota-bar-wrap">
						<div class="quota-bar-track">
							<div
								class="quota-bar-fill"
								style="width: {quotaPct}%; background: {quotaColor};"
							></div>
						</div>
						<span class="quota-pct" style="color: {quotaColor};">{quotaPct.toFixed(1)}%</span>
					</div>
					<div class="quota-stats">
						<div class="quota-stat">
							<span class="quota-stat-label">Used</span>
							<span class="quota-stat-value">{fmtTokens(data.aiUsage.effectiveUsage)}</span>
						</div>
						{#if data.aiUsage.goodWillTokens > 0}
							<div class="quota-stat">
								<span class="quota-stat-label">Good-will refunded</span>
								<span class="quota-stat-value good-will"
									>+{fmtTokens(data.aiUsage.goodWillTokens)}</span
								>
							</div>
						{/if}
						<div class="quota-stat">
							<span class="quota-stat-label">Daily limit</span>
							<span class="quota-stat-value">{fmtTokens(data.aiUsage.dailyQuota)}</span>
						</div>
					</div>
					{#if quotaPct >= 90}
						<p class="quota-warning">
							You're close to your daily limit. Usage resets at midnight UTC.
						</p>
					{/if}
				</section>
			{:else}
				<section class="card quota-card">
					<h2>Daily AI Usage</h2>
					<p class="quota-desc">You're using a custom LLM server — no daily quota applies.</p>
				</section>
			{/if}

			<!-- Streak Freeze -->
			<section class="card streak-card">
				<h2>Streak Freeze</h2>
				<p class="card-desc">
					A streak freeze protects your streak if you miss a day. It's consumed automatically when
					you return after exactly one missed day.
				</p>
				<div class="freeze-row">
					<div class="freeze-shields">
						{#each Array(5) as _, i}
							<span
								class="freeze-shield"
								class:active={i < freezeCount}
								aria-label={i < freezeCount ? 'Active freeze' : 'Empty slot'}
							>
								<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" />
								</svg>
							</span>
						{/each}
						<span class="freeze-count">{freezeCount}/5</span>
					</div>
					<div class="freeze-buy">
						<span class="freeze-xp-cost">200 XP</span>
						<button
							type="button"
							class="btn-buy-freeze"
							onclick={buyStreakFreeze}
							disabled={isBuyingFreeze || freezeCount >= 5 || freezeXp < 200}
						>
							{isBuyingFreeze ? 'Buying...' : 'Buy Freeze'}
						</button>
						<span class="freeze-xp-balance">You have {freezeXp} XP</span>
					</div>
				</div>
			</section>
		</div>

		<!-- ACCOUNT TAB -->
	{:else if activeTab === 'account'}
		<div in:fly={{ y: 16, duration: 300 }}>
			<section class="card">
				<h2>Change Username</h2>
				<form
					method="POST"
					action="?/updateUsername"
					use:enhance={() => {
						isUpdatingUsername = true;
						usernameSuggestion = null;
						return async ({ update }) => {
							await update();
							isUpdatingUsername = false;
							newUsername = '';
						};
					}}
				>
					<div class="form-group">
						<label for="username">New Username</label>
						<input
							type="text"
							id="username"
							name="username"
							bind:value={newUsername}
							placeholder={data.user?.username}
							minlength="3"
							maxlength="31"
							required
						/>
						{#if (form as any)?.usernameError}
							<p class="field-error">{(form as any).usernameError}</p>
						{/if}
						{#if usernameSuggestion}
							<p class="username-suggestion">
								How about <strong>{usernameSuggestion}</strong>?
								<button
									type="button"
									class="use-suggestion-btn"
									onclick={() => {
										newUsername = usernameSuggestion!;
									}}>Use this</button
								>
							</p>
						{/if}
					</div>
					<button type="submit" class="submit-btn" disabled={isUpdatingUsername}>
						{isUpdatingUsername ? 'Checking...' : 'Update Username'}
					</button>
				</form>
			</section>

			{#if data.localLoginEnabled}
				<section class="card">
					<h2>Update Password</h2>
					<form
						method="POST"
						action="?/updatePassword"
						use:enhance={() => {
							isUpdatingPassword = true;
							return async ({ update }) => {
								await update();
								isUpdatingPassword = false;
							};
						}}
					>
						{#if data.hasPassword}
							<div class="form-group">
								<label for="currentPassword">Current Password</label>
								<input
									type="password"
									id="currentPassword"
									name="currentPassword"
									placeholder="••••••••••••••••"
									required
								/>
							</div>
						{/if}
						<div class="form-group">
							<label for="newPassword">New Password</label>
							<input
								type="password"
								id="newPassword"
								name="newPassword"
								placeholder="••••••••••••••••"
								required
								minlength="8"
							/>
						</div>
						<button type="submit" class="submit-btn" disabled={isUpdatingPassword}>
							{isUpdatingPassword ? 'Updating...' : 'Update Password'}
						</button>
					</form>
				</section>
			{/if}
		</div>

		<!-- AI / LLM TAB -->
	{:else if activeTab === 'ai'}
		<div in:fly={{ y: 16, duration: 300 }}>
			<section class="card">
				<h2>Custom LLM Server</h2>
				<p class="card-desc">
					Connect your own local or remote LLM (e.g. Ollama, LM Studio). Using your own server
					removes the daily AI quota.
				</p>
				<form
					method="POST"
					action="?/updateLlmSettings"
					use:enhance={() => {
						isUpdatingLLM = true;
						return async ({ update }) => {
							await update();
							isUpdatingLLM = false;
						};
					}}
				>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							id="useLocalLlm"
							name="useLocalLlm"
							checked={data.user?.useLocalLlm}
							class="llm-checkbox"
						/>
						<label for="useLocalLlm" class="llm-checkbox-label">Enable Custom LLM Server</label>
					</div>

					<div class="form-group">
						<label for="llmBaseUrl">API Endpoint (OpenAI compatible)</label>
						<div style="display: flex; gap: 0.5rem;">
							<input
								type="text"
								id="llmBaseUrl"
								name="llmBaseUrl"
								bind:value={llmBaseUrl}
								placeholder="http://localhost:11434/v1"
								style="flex: 1;"
							/>
							<button
								type="button"
								class="fetch-models-btn"
								onclick={fetchModels}
								disabled={isFetchingModels || !llmBaseUrl}
							>
								{isFetchingModels ? 'Fetching...' : 'Fetch Models →'}
							</button>
						</div>
					</div>

					<div class="form-group">
						<label for="llmApiKey">API Key (if required)</label>
						<input
							type="password"
							id="llmApiKey"
							name="llmApiKey"
							bind:value={llmApiKey}
							placeholder="sk-..."
						/>
					</div>

					<div class="form-group">
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
								placeholder="e.g., llama3.2, gpt-4o-mini"
							/>
							{#if llmBaseUrl}
								<p class="model-hint">
									Enter your endpoint above and click <strong>Fetch Models →</strong> to list available
									models.
								</p>
							{/if}
						{/if}
					</div>

					<button type="submit" class="submit-btn" disabled={isUpdatingLLM}>
						{isUpdatingLLM ? 'Saving...' : 'Save LLM Settings'}
					</button>
				</form>
			</section>

			<section class="card">
				<h2>Review Frequency (FSRS)</h2>
				<p class="card-desc">
					Controls how well you must remember an item before it's scheduled further out. Higher
					retention means more frequent reviews and stronger recall. Lower retention means fewer
					reviews but you may forget more.
				</p>
				<form
					method="POST"
					action="?/updateFsrsRetention"
					use:enhance={() => {
						isUpdatingFsrs = true;
						return async ({ update }) => {
							await update();
							isUpdatingFsrs = false;
						};
					}}
				>
					<div class="form-group">
						<label for="fsrsRetention"
							>Target Retention: <strong>{Math.round(fsrsRetention * 100)}%</strong></label
						>
						<input
							type="range"
							id="fsrsRetention"
							name="fsrsRetention"
							min="0.70"
							max="0.97"
							step="0.01"
							bind:value={fsrsRetention}
							style="width: 100%; margin-top: 0.5rem;"
						/>
						<div
							style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;"
						>
							<span>70% (fewer reviews)</span>
							<span>90% (default)</span>
							<span>97% (more reviews)</span>
						</div>
					</div>
					<button type="submit" class="submit-btn" disabled={isUpdatingFsrs}>
						{isUpdatingFsrs ? 'Saving...' : 'Save'}
					</button>
				</form>
			</section>
		</div>

		<!-- DANGER TAB -->
	{:else if activeTab === 'danger'}
		<div in:fly={{ y: 16, duration: 300 }}>
			<section class="card danger-card">
				<h2>Delete Account</h2>
				<p class="warning-text">
					Deleting your account is permanent and cannot be undone. All your progress, vocabulary,
					and settings will be lost.
				</p>
				<button
					class="delete-btn"
					onclick={() =>
						(document.getElementById('delete-modal') as HTMLDialogElement)?.showModal()}
				>
					Delete My Account
				</button>
			</section>
		</div>
	{/if}
</div>

<!-- Delete modal (outside tab content so it's always in DOM) -->
<dialog id="delete-modal" class="modal">
	<div class="modal-box">
		<h3>Delete Account</h3>
		<p>Are you absolutely sure? This action cannot be undone.</p>
		<p class="delete-confirm-label">Type <strong>DELETE</strong> to confirm:</p>
		<input
			type="text"
			bind:value={deleteConfirmation}
			placeholder="Type DELETE"
			class="delete-confirm-input"
			aria-label="Type DELETE to confirm"
		/>
		<div class="modal-actions">
			<form method="dialog">
				<button class="btn-cancel">Cancel</button>
			</form>
			<form
				method="POST"
				action="?/deleteAccount"
				use:enhance={() => {
					isDeletingAccount = true;
					return async ({ update }) => {
						await update();
						isDeletingAccount = false;
					};
				}}
			>
				<button class="btn-confirm-delete" type="submit" disabled={!canDelete || isDeletingAccount}>
					{isDeletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
				</button>
			</form>
		</div>
	</div>
</dialog>

<style>
	.profile-container {
		max-width: 640px;
		margin: 0 auto;
		color: var(--text-color, #334155);
	}

	.profile-header {
		margin-bottom: 1.5rem;
	}

	.profile-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-color, #111827);
		margin: 0;
	}

	/* Tab bar */
	.tab-bar {
		display: flex;
		gap: 0.25rem;
		border-bottom: 2px solid var(--card-border, #e5e7eb);
		margin-bottom: 1.75rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab-bar::-webkit-scrollbar {
		display: none;
	}

	.tab-btn {
		padding: 0.5rem 1rem;
		border: none;
		background: none;
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		white-space: nowrap;
		transition:
			color 0.15s,
			border-color 0.15s;
		border-radius: 0.25rem 0.25rem 0 0;
	}

	.tab-btn:hover {
		color: var(--text-color, #111827);
	}

	.tab-btn.active {
		color: #22c55e;
		border-bottom-color: #22c55e;
		font-weight: 600;
	}

	.tab-btn.danger-tab {
		color: #ef4444;
	}
	.tab-btn.danger-tab:hover {
		color: #dc2626;
	}
	.tab-btn.danger-tab.active {
		color: #dc2626;
		border-bottom-color: #dc2626;
	}

	:global(html[data-theme='dark']) .tab-btn {
		color: #94a3b8;
	}
	:global(html[data-theme='dark']) .tab-btn:hover {
		color: #e2e8f0;
	}
	:global(html[data-theme='dark']) .tab-btn.active {
		color: #22c55e;
	}

	/* Cards */
	.card {
		background: var(--card-bg, #ffffff);
		border: 1px solid var(--card-border, #e5e7eb);
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.card h2 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-color, #111827);
		margin: 0 0 1.25rem 0;
	}

	.card-desc {
		color: #64748b;
		font-size: 0.875rem;
		margin: -0.5rem 0 1.25rem;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .card-desc {
		color: #94a3b8;
	}

	/* Username row */
	.username-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.username-display {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--text-color, #111827);
	}

	.admin-badge {
		color: #f59e0b;
		display: flex;
		align-items: center;
	}

	/* Language progress cards */
	.lang-progress-card h2 {
		margin-bottom: 1rem;
	}

	.lang-cards {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.lang-card {
		border: 1px solid var(--card-border, #e5e7eb);
		border-radius: 0.6rem;
		padding: 0.875rem 1rem;
	}

	:global(html[data-theme='dark']) .lang-card {
		border-color: #334155;
	}

	.lang-card-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-bottom: 0.6rem;
	}

	.lang-flag {
		font-size: 1.4rem;
		line-height: 1;
	}

	.lang-name {
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--text-color, #111827);
		flex: 1;
	}

	.level-badge {
		display: inline-block;
		background-color: #dbeafe;
		color: #2563eb;
		padding: 0.1rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 700;
	}

	:global(html[data-theme='dark']) .level-badge {
		background-color: #1e3a5f;
		color: #93c5fd;
	}

	.lang-progress-bar-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.lang-progress-bar-track {
		flex: 1;
		height: 6px;
		background: var(--card-border, #e5e7eb);
		border-radius: 9999px;
		overflow: hidden;
	}

	.lang-progress-bar-fill {
		height: 100%;
		border-radius: 9999px;
		background: #22c55e;
		transition: width 0.4s ease;
	}

	.lang-progress-pct {
		font-size: 0.75rem;
		font-weight: 700;
		color: #22c55e;
		min-width: 2.5rem;
		text-align: right;
	}

	.lang-next-level {
		margin: 0.35rem 0 0;
		font-size: 0.72rem;
		color: #9ca3af;
		font-weight: 500;
	}

	/* AI Quota */
	.quota-card h2 {
		margin-bottom: 0.5rem;
	}

	.quota-bar-wrap {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 1rem 0 0.75rem;
	}

	.quota-bar-track {
		flex: 1;
		height: 10px;
		background: var(--card-border, #e5e7eb);
		border-radius: 9999px;
		overflow: hidden;
	}

	.quota-bar-fill {
		height: 100%;
		border-radius: 9999px;
		transition:
			width 0.4s ease,
			background 0.3s;
	}

	.quota-pct {
		font-size: 0.8rem;
		font-weight: 700;
		min-width: 3.5rem;
		text-align: right;
	}

	.quota-stats {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.quota-stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.quota-stat-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #9ca3af;
	}

	.quota-stat-value {
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--text-color, #111827);
	}

	.quota-stat-value.good-will {
		color: #22c55e;
	}

	.quota-warning {
		margin: 0.75rem 0 0;
		font-size: 0.8rem;
		color: #ef4444;
		font-weight: 500;
	}

	/* Streak freeze */
	.streak-card {
		border-radius: 0.75rem;
	}

	.freeze-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.freeze-shields {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.freeze-shield {
		width: 2rem;
		height: 2rem;
		color: #cbd5e1;
		transition:
			color 0.2s,
			transform 0.2s;
	}

	.freeze-shield svg {
		width: 100%;
		height: 100%;
	}

	.freeze-shield.active {
		color: #3b82f6;
		transform: scale(1.1);
	}

	.freeze-count {
		font-size: 0.8rem;
		font-weight: 800;
		color: #64748b;
		margin-left: 0.25rem;
	}

	.freeze-buy {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.freeze-xp-cost {
		font-size: 0.875rem;
		font-weight: 800;
		color: #f59e0b;
	}

	.btn-buy-freeze {
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.75rem;
		padding: 0.5rem 1.1rem;
		font-size: 0.875rem;
		font-weight: 800;
		cursor: pointer;
		box-shadow: 0 3px 0 #2563eb;
		font-family: inherit;
		transition: all 0.15s;
	}

	.btn-buy-freeze:hover:not(:disabled) {
		background: #2563eb;
		transform: translateY(-1px);
		box-shadow: 0 4px 0 #1d4ed8;
	}

	.btn-buy-freeze:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.freeze-xp-balance {
		font-size: 0.75rem;
		font-weight: 600;
		color: #94a3b8;
	}

	:global(html[data-theme='dark']) .freeze-count {
		color: #94a3b8;
	}

	/* Forms */
	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.375rem;
	}

	:global(html[data-theme='dark']) .form-group label {
		color: #cbd5e1;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--input-border, #d1d5db);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: var(--input-text, #111827);
		background: var(--input-bg, #ffffff);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.fetch-models-btn {
		background: #eff6ff;
		border: 1px solid #93c5fd;
		padding: 0.625rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #2563eb;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.fetch-models-btn:hover:not(:disabled) {
		background-color: #dbeafe;
		border-color: #60a5fa;
	}

	.fetch-models-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		background: none;
		border-color: var(--input-border, #d1d5db);
		color: var(--input-text, #4b5563);
		font-weight: 500;
	}

	:global(html[data-theme='dark']) .fetch-models-btn {
		background: #1e3a5f;
		border-color: #3b82f6;
		color: #93c5fd;
	}

	:global(html[data-theme='dark']) .fetch-models-btn:hover:not(:disabled) {
		background: #1e40af;
		border-color: #60a5fa;
	}

	:global(html[data-theme='dark']) .fetch-models-btn:disabled {
		background: none;
		border-color: var(--input-border, #4b5563);
		color: var(--input-text, #6b7280);
	}

	.model-hint {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: #6b7280;
		line-height: 1.4;
	}

	.model-hint strong {
		color: #2563eb;
	}

	:global(html[data-theme='dark']) .model-hint {
		color: #94a3b8;
	}
	:global(html[data-theme='dark']) .model-hint strong {
		color: #93c5fd;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1.25rem;
		padding: 0.75rem;
		background: var(--card-bg, #f9fafb);
		border: 1px solid var(--input-border, #e5e7eb);
		border-radius: 0.5rem;
		transition: background-color 0.15s;
	}

	.checkbox-wrapper:hover {
		background: var(--link-hover-bg, #f3f4f6);
	}

	.llm-checkbox {
		width: 1.125rem;
		height: 1.125rem;
		border-radius: 0.25rem;
		border: 2px solid var(--input-border, #d1d5db);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.llm-checkbox:checked {
		background-color: #22c55e;
		border-color: #22c55e;
	}

	.llm-checkbox:focus {
		outline: none;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.llm-checkbox-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--input-text, #374151);
		cursor: pointer;
		margin: 0;
		user-select: none;
	}

	.field-error {
		margin: 0.375rem 0 0;
		font-size: 0.8rem;
		color: #ef4444;
		font-weight: 500;
	}

	.username-suggestion {
		margin: 0.5rem 0 0;
		font-size: 0.85rem;
		color: #6b7280;
	}

	:global(html[data-theme='dark']) .username-suggestion {
		color: #94a3b8;
	}

	.use-suggestion-btn {
		background: none;
		border: none;
		color: #22c55e;
		font-weight: 700;
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0;
		margin-left: 0.25rem;
		text-decoration: underline;
	}

	.use-suggestion-btn:hover {
		color: #16a34a;
	}

	.submit-btn {
		background-color: #22c55e;
		color: white;
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-top: 0.5rem;
	}

	.submit-btn:hover {
		background-color: #16a34a;
	}
	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Danger */
	.danger-card {
		border-color: #fecaca;
	}

	.danger-card h2 {
		color: #991b1b;
	}

	.warning-text {
		color: #6b7280;
		font-size: 0.875rem;
		margin: -0.5rem 0 1.25rem;
	}

	.delete-btn {
		background-color: #ef4444;
		color: white;
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.delete-btn:hover {
		background-color: #dc2626;
	}

	/* Modal */
	.modal {
		border: none;
		border-radius: 1rem;
		padding: 0;
		background: transparent;
	}

	.modal::backdrop {
		background: rgba(0, 0, 0, 0.5);
	}

	.modal-box {
		background: var(--card-bg, #ffffff);
		padding: 1.5rem;
		border-radius: 1rem;
		max-width: 400px;
		width: 100%;
	}

	.modal-box h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #991b1b;
	}

	.modal-box p {
		margin: 0 0 1rem 0;
		color: #4b5563;
		font-size: 0.875rem;
	}

	.delete-confirm-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #ef4444;
		margin-bottom: 0.5rem !important;
	}

	.delete-confirm-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		margin-bottom: 1rem;
		border: 2px solid #ef4444;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		box-sizing: border-box;
		background: var(--input-bg, #fff);
		color: var(--input-text, #111827);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn-cancel {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--card-border, #d1d5db);
		background: var(--card-bg, #ffffff);
		color: var(--text-color, #374151);
	}

	.btn-cancel:hover {
		background: #f3f4f6;
	}

	.btn-confirm-delete {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
		background: #ef4444;
		color: white;
	}

	.btn-confirm-delete:hover:not(:disabled) {
		background: #dc2626;
	}
	.btn-confirm-delete:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.profile-container {
			padding: 0 0.5rem;
		}
		.profile-header h1 {
			font-size: 1.75rem;
		}
		.submit-btn,
		.delete-btn {
			width: 100%;
			box-sizing: border-box;
		}
		.quota-stats {
			gap: 1rem;
		}
	}
</style>
