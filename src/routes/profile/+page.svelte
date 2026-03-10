<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';

	export let data: PageData;
	export let form;
</script>

<div class="profile-container">
	<header class="profile-header" in:fly={{ y: 20, duration: 400 }}>
		<h1 class="dark:text-white">Profile</h1>
		<p class="dark:text-slate-400">Manage your account settings.</p>
	</header>

	<section
		class="info-card dark:bg-slate-800 dark:border-slate-700"
		in:fly={{ y: 20, duration: 400, delay: 100 }}
	>
		<h2 class="dark:text-white">Your Information</h2>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label dark:text-slate-400">Username</span>
				<span class="info-value dark:text-white">{data.user?.username}</span>
			</div>
			<div class="info-item">
				<span class="info-label dark:text-slate-400">Active Language</span>
				<span class="info-value dark:text-white">{data.user?.activeLanguage?.name || 'None'}</span>
			</div>
			<div class="info-item">
				<span class="info-label dark:text-slate-400">CEFR Level (Active)</span>
				<span class="info-value level-badge">{data.activeProgress?.cefrLevel || 'A1'}</span>
			</div>
			<div class="info-item">
				<span class="info-label dark:text-slate-400">Role</span>
				<span class="info-value dark:text-white">{data.user?.role}</span>
			</div>
		</div>
	</section>

	<section
		class="theme-card dark:bg-slate-800 dark:border-slate-700"
		in:fly={{ y: 20, duration: 400, delay: 150 }}
	>
		<h2 class="dark:text-white">Theme Settings</h2>

		{#if form?.themeSuccess}
			<div class="alert alert-success">{form.themeSuccess}</div>
		{/if}
		{#if form?.themeError}
			<div class="alert alert-error">{form.themeError}</div>
		{/if}

		<form
			method="POST"
			action="?/updateTheme"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						const select = document.getElementById('theme') as HTMLSelectElement;
						document.documentElement.setAttribute('data-theme', select.value);
					}
					await update();
				};
			}}
		>
			<div class="form-group">
				<label for="theme" class="dark:text-slate-300">Select Theme</label>
				<select
					id="theme"
					name="theme"
					class="theme-select dark:bg-slate-900 dark:text-white dark:border-slate-700"
				>
					<option value="default" selected={data.user?.theme === 'default'}>Default</option>
					<option value="dark" selected={data.user?.theme === 'dark'}>Dark</option>
				</select>
			</div>
			<button type="submit" class="submit-btn">Update Theme</button>
		</form>
	</section>

	<section
		class="llm-card dark:bg-slate-800 dark:border-slate-700"
		in:fly={{ y: 20, duration: 400, delay: 175 }}
	>
		<h2 class="dark:text-white">Local LLM Settings</h2>
		<p class="dark:text-slate-400 text-sm mb-4">
			Use your own local or remote LLM server (e.g. Ollama, LM Studio). Using your own server removes rate limits!
		</p>

		{#if form && 'llmSuccess' in form && form.llmSuccess}
			<div class="alert alert-success">{form.llmSuccess}</div>
		{/if}
		{#if form && 'llmError' in form && form.llmError}
			<div class="alert alert-error">{form.llmError}</div>
		{/if}

		<form method="POST" action="?/updateLlmSettings" use:enhance>
			<div class="form-group flex items-center gap-2 mb-4">
				<input
					type="checkbox"
					id="useLocalLlm"
					name="useLocalLlm"
					checked={data.user?.useLocalLlm}
					class="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
				/>
				<label for="useLocalLlm" class="dark:text-slate-300 mb-0 cursor-pointer">
					Enable Custom LLM Server
				</label>
			</div>

			<div class="form-group">
				<label for="llmBaseUrl" class="dark:text-slate-300">API Endpoint (OpenAI compatible)</label>
				<input
					type="text"
					id="llmBaseUrl"
					name="llmBaseUrl"
					placeholder="http://localhost:11434/v1"
					value={data.user?.llmBaseUrl || ''}
					class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
				/>
			</div>

			<div class="form-group">
				<label for="llmApiKey" class="dark:text-slate-300">API Key (if required)</label>
				<input
					type="password"
					id="llmApiKey"
					name="llmApiKey"
					placeholder="sk-..."
					value={data.user?.llmApiKey || ''}
					class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
				/>
			</div>

			<button type="submit" class="submit-btn">Save LLM Settings</button>
		</form>
	</section>

	{#if data.localLoginEnabled}
		<section
			class="password-card dark:bg-slate-800 dark:border-slate-700"
			in:fly={{ y: 20, duration: 400, delay: 200 }}
		>
			<h2 class="dark:text-white">Update Password</h2>

			{#if form?.error}
				<div class="alert alert-error">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="alert alert-success">{form.success}</div>
			{/if}

			<form method="POST" action="?/updatePassword">
				{#if data.hasPassword}
					<div class="form-group">
						<label for="currentPassword" class="dark:text-slate-300">Current Password</label>
						<input
							type="password"
							id="currentPassword"
							name="currentPassword"
							required
							class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
						/>
					</div>
				{/if}

				<div class="form-group">
					<label for="newPassword" class="dark:text-slate-300">New Password</label>
					<input
						type="password"
						id="newPassword"
						name="newPassword"
						required
						minlength="8"
						class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
					/>
				</div>

				<button type="submit" class="submit-btn">Update Password</button>
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
			on:click={() => (document.getElementById('delete-modal') as HTMLDialogElement)?.showModal()}
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
					<form method="POST" action="?/deleteAccount">
						<button class="btn btn-error" type="submit">Yes, Delete My Account</button>
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
		color: #334155;
	}

	.profile-header {
		margin-bottom: 2rem;
	}

	.profile-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}

	.profile-header p {
		color: #6b7280;
		margin: 0;
	}

	.info-card,
	.password-card,
	.theme-card,
	.llm-card {
		background: var(--card-bg, #ffffff);
		border: 1px solid #e5e7eb;
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
		color: #111827;
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
		color: #111827;
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

	.alert {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1rem;
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

	.form-group input,
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
	.theme-select:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
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
