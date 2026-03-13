<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import { onMount } from 'svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast';

	let { data, form }: { data: PageData; form: any } = $props();

	// Form submission states
	let isUpdatingTheme = $state(false);
	let isUpdatingLLM = $state(false);
	let isUpdatingPassword = $state(false);
	let isUpdatingLanguage = $state(false);
	let isDeletingAccount = $state(false);

	// LLM settings state (local editable copies of server data)
	let llmBaseUrl = $state('');
	let llmApiKey = $state('');
	let llmModel = $state('');
	$effect(() => {
		llmBaseUrl = data.user?.llmBaseUrl ?? '';
		llmApiKey = data.user?.llmApiKey ?? '';
		llmModel = data.user?.llmModel ?? '';
	});
	let availableModels = $state<string[]>([]);
	let isFetchingModels = $state(false);

	// Account deletion confirmation
	let deleteConfirmation = $state('');
	let canDelete = $derived(deleteConfirmation === 'DELETE');

	// Show success/error messages as toasts
	$effect(() => {
		if (form?.themeSuccess) toastSuccess(form.themeSuccess);
		if (form?.llmSuccess) toastSuccess(form.llmSuccess);
		if (form?.passwordSuccess) toastSuccess(form.passwordSuccess);
		if (form?.languageSuccess) toastSuccess(form.languageSuccess);
		if (form?.themeError) toastError(form.themeError);
		if (form?.llmError) toastError(form.llmError);
		if (form?.passwordError) toastError(form.passwordError);
		if (form?.languageError) toastError(form.languageError);
	});

	// AbortController for fetch race condition prevention
	let fetchModelsController: AbortController | null = null;

	// Fetch models from the LLM endpoint
	async function fetchModels() {
		if (!llmBaseUrl) {
			availableModels = [];
			return;
		}

		// Cancel previous request
		fetchModelsController?.abort();
		fetchModelsController = new AbortController();

		isFetchingModels = true;
		try {
			let fetchUrl = llmBaseUrl;
			if (!fetchUrl.endsWith('/v1/models') && !fetchUrl.endsWith('/v1/models/')) {
				fetchUrl = fetchUrl.replace(/\/+$/, '') + '/v1/models';
			}

			const headers: Record<string, string> = {};
			if (llmApiKey) {
				headers['Authorization'] = `Bearer ${llmApiKey}`;
			}

			const res = await fetch(fetchUrl, {
				headers,
				signal: fetchModelsController.signal
			});
			if (res.ok) {
				const data = await res.json();
				if (data && data.data && Array.isArray(data.data)) {
					availableModels = data.data.map((m: any) => m.id);
				} else if (Array.isArray(data)) {
					availableModels = data.map((m: any) => m.id || m);
				} else {
					availableModels = [];
				}
			} else {
				availableModels = [];
			}
		} catch (error: any) {
			if (error.name === 'AbortError') return;
			console.error('Failed to fetch models', error);
			availableModels = [];
		} finally {
			isFetchingModels = false;
		}
	}

	onMount(() => {
		if (llmBaseUrl) fetchModels();
	});
</script>

<div class="profile-container">
	<header class="profile-header" in:fly={{ y: 20, duration: 400 }}>
		<h1>Profile</h1>
		<p>Manage your account settings.</p>
	</header>

	<section
		class="info-card"
		in:fly={{ y: 20, duration: 400, delay: 100 }}
	>
		<h2>Your Information</h2>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">Username</span>
				<span class="info-value">{data.user?.username}</span>
			</div>
			<div class="info-item">
				<span class="info-label">Active Language</span>
				<span class="info-value">{data.user?.activeLanguage?.name || 'None'}</span>
			</div>
			<div class="info-item">
				<span class="info-label">CEFR Level (Active)</span>
				<span class="info-value level-badge">{data.activeProgress?.cefrLevel || 'A1'}</span>
			</div>
			<div class="info-item">
				<span class="info-label">Role</span>
				<span class="info-value">{data.user?.role}</span>
			</div>
		</div>
	</section>

	<section
		class="theme-card"
		in:fly={{ y: 20, duration: 400, delay: 150 }}
	>
		<h2>Theme Settings</h2>

		<form
			method="POST"
			action="?/updateTheme"
			use:enhance={() => {
				isUpdatingTheme = true;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const select = document.getElementById('theme') as HTMLSelectElement;
						document.documentElement.setAttribute('data-theme', select.value);
					}
					await update();
					isUpdatingTheme = false;
				};
			}}
		>
			<div class="form-group">
				<label for="theme">Select Theme</label>
				<select
					id="theme"
					name="theme"
					class="theme-select"
				>
					<option value="default" selected={data.user?.theme === 'default'}>Default</option>
					<option value="dark" selected={data.user?.theme === 'dark'}>Dark</option>
				</select>
			</div>
			<button type="submit" class="submit-btn" disabled={isUpdatingTheme}>
				{isUpdatingTheme ? 'Updating...' : 'Update Theme'}
			</button>
		</form>
	</section>

	<section
		class="llm-card"
		in:fly={{ y: 20, duration: 400, delay: 175 }}
	>
		<h2>Local LLM Settings</h2>
		<p class="llm-desc">
			Use your own local or remote LLM server (e.g. Ollama, LM Studio). Using your own server removes rate limits!
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
				<label for="useLocalLlm" class="llm-checkbox-label">
					Enable Custom LLM Server
				</label>
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
						{isFetchingModels ? 'Fetching...' : 'Fetch Models \u2192'}
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
					<select
						id="llmModel"
						name="llmModel"
						bind:value={llmModel}
					>
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
							Enter your API endpoint above and click <strong>Fetch Models &rarr;</strong> to populate available models, or type a model name manually.
						</p>
					{/if}
				{/if}
			</div>

			<button type="submit" class="submit-btn" disabled={isUpdatingLLM}>
				{isUpdatingLLM ? 'Saving...' : 'Save LLM Settings'}
			</button>
		</form>
	</section>

	{#if data.localLoginEnabled}
		<section
			class="password-card"
			in:fly={{ y: 20, duration: 400, delay: 200 }}
		>
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

	<section class="delete-card" in:fly={{ y: 20, duration: 400, delay: 250 }}>
		<h2>Danger Zone</h2>
		<p class="warning-text">
			Deleting your account is permanent and cannot be undone. All your progress, vocabulary, and
			settings will be lost.
		</p>

		<button
			class="delete-btn"
			onclick={() => (document.getElementById('delete-modal') as HTMLDialogElement)?.showModal()}
		>
			Delete Account
		</button>

		<dialog id="delete-modal" class="modal">
			<div class="modal-box">
				<h3 class="font-bold text-lg text-red-600">Delete Account</h3>
				<p class="py-4">
					Are you absolutely sure you want to delete your account? This action cannot be undone.
				</p>
				<div class="modal-action">
					<form method="dialog">
						<button class="btn">Cancel</button>
					</form>
					<p style="margin-bottom: 1rem; color: #ef4444; font-weight: 600;">
						Type <strong>DELETE</strong> to confirm account deletion:
					</p>
					<input
						type="text"
						bind:value={deleteConfirmation}
						placeholder="Type DELETE"
						style="width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 2px solid #ef4444; border-radius: 0.5rem;"
						aria-label="Type DELETE to confirm"
					/>
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
						<button class="btn btn-error" type="submit" disabled={!canDelete || isDeletingAccount}>
							{isDeletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
						</button>
					</form>
				</div>
			</div>
		</dialog>
	</section>
</div>

<style>
	.profile-container {
		max-width: 640px;
		margin: 0 auto;
		color: var(--text-color, #334155);
	}

	.profile-header {
		margin-bottom: 2rem;
	}

	.profile-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-color, #111827);
		margin: 0 0 0.5rem 0;
	}

	.profile-header p {
		color: #6b7280;
		margin: 0;
	}

	:global(html[data-theme='dark']) .profile-header p {
		color: #94a3b8;
	}

	.info-card,
	.password-card,
	.theme-card,
	.llm-card {
		background: var(--card-bg, #ffffff);
		border: 1px solid var(--card-border, #e5e7eb);
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.info-card h2,
	.password-card h2,
	.theme-card h2,
	.llm-card h2 {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--text-color, #111827);
		margin: 0 0 1.25rem 0;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #9ca3af;
	}

	.info-value {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-color, #111827);
	}

	.level-badge {
		display: inline-block;
		background-color: #dbeafe;
		color: #2563eb;
		padding: 0.1rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
		width: fit-content;
	}

	.llm-desc {
		color: #64748b;
		font-size: 0.9rem;
		margin: -0.5rem 0 1.25rem;
		line-height: 1.5;
	}

	:global(html[data-theme='dark']) .llm-desc {
		color: #94a3b8;
	}

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
	.form-group select,
	.theme-select {
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
	.form-group select:focus,
	.theme-select:focus {
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

	.delete-card {
		background: var(--card-bg, #ffffff);
		border: 1px solid #fecaca;
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.delete-card h2 {
		font-size: 1.125rem;
		font-weight: 600;
		color: #991b1b;
		margin: 0 0 0.5rem 0;
	}

	.warning-text {
		color: #6b7280;
		font-size: 0.875rem;
		margin: 0 0 1rem 0;
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
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: #111827;
	}

	.modal-box p {
		margin: 0 0 1.5rem 0;
		color: #4b5563;
		font-size: 0.875rem;
	}

	.modal-action {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--card-border, #d1d5db);
		background: var(--card-bg, #ffffff);
		color: var(--text-color, #374151);
	}

	.btn:hover {
		background: #f3f4f6;
	}

	.btn-error {
		background: #ef4444;
		color: white;
		border: none;
	}

	.btn-error:hover {
		background: #dc2626;
	}

	@media (max-width: 768px) {
		.profile-container {
			padding: 1rem 0.5rem;
		}

		.profile-header h1 {
			font-size: 1.75rem;
		}

		.submit-btn,
		.delete-btn {
			width: 100%;
			box-sizing: border-box;
		}

		.info-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
