<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';

	export let data: PageData;
	export let form;
</script>

<div class="profile-container">
	<header class="profile-header">
		<h1>Profile</h1>
		<p>Manage your account settings.</p>
	</header>

	<section class="info-card">
		<h2>Your Information</h2>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">Username</span>
				<span class="info-value">{data.user?.username}</span>
			</div>
			<div class="info-item">
				<span class="info-label">CEFR Level</span>
				<span class="info-value level-badge">{data.user?.cefrLevel}</span>
			</div>
			<div class="info-item">
				<span class="info-label">Role</span>
				<span class="info-value">{data.user?.role}</span>
			</div>
		</div>
	</section>

	<section class="theme-card">
		<h2>Theme Settings</h2>
		
		{#if form?.themeSuccess}
			<div class="alert alert-success">{form.themeSuccess}</div>
		{/if}
		{#if form?.themeError}
			<div class="alert alert-error">{form.themeError}</div>
		{/if}

		<form method="POST" action="?/updateTheme" use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					const select = document.getElementById('theme') as HTMLSelectElement;
					document.documentElement.setAttribute('data-theme', select.value);
				}
				await update();
			};
		}}>
			<div class="form-group">
				<label for="theme">Select Theme</label>
				<select id="theme" name="theme" class="theme-select">
					<option value="default" selected={data.user?.theme === 'default'}>Default</option>
					<option value="dark" selected={data.user?.theme === 'dark'}>Dark</option>
					<option value="bavarian" selected={data.user?.theme === 'bavarian'}>Historic German (Bavarian)</option>
				</select>
			</div>
			<button type="submit" class="submit-btn">Update Theme</button>
		</form>
	</section>

	{#if data.localLoginEnabled}
		<section class="password-card">
			<h2>Update Password</h2>

			{#if form?.error}
				<div class="alert alert-error">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="alert alert-success">{form.success}</div>
			{/if}

			<form method="POST" action="?/updatePassword">
				{#if data.hasPassword}
					<div class="form-group">
						<label for="currentPassword">Current Password</label>
						<input type="password" id="currentPassword" name="currentPassword" required />
					</div>
				{/if}

				<div class="form-group">
					<label for="newPassword">New Password</label>
					<input type="password" id="newPassword" name="newPassword" required minlength="8" />
				</div>

				<button type="submit" class="submit-btn">Update Password</button>
			</form>
		</section>
	{/if}

	<section class="delete-card">
		<h2>Danger Zone</h2>
		<p class="warning-text">Deleting your account is permanent and cannot be undone. All your progress, vocabulary, and settings will be lost.</p>
		
		<button class="delete-btn" on:click={() => (document.getElementById('delete-modal') as HTMLDialogElement)?.showModal()}>
			Delete Account
		</button>

		<dialog id="delete-modal" class="modal">
			<div class="modal-box">
				<h3 class="font-bold text-lg text-red-600">Delete Account</h3>
				<p class="py-4">Are you absolutely sure you want to delete your account? This action cannot be undone.</p>
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
	.theme-card {
		background: var(--card-bg, #ffffff);
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.info-card h2,
	.password-card h2,
	.theme-card h2 {
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
		transition: border-color 0.2s, box-shadow 0.2s;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.theme-select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.submit-btn {
		background-color: #2563eb;
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
		background-color: #1d4ed8;
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
</style>