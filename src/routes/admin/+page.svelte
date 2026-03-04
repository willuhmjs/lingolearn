<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageData, ActionData } from './$types';
	export let data: PageData;
	export let form: ActionData;

	let isRunningSeed = false;

	// Modal state
	let editingUser: {
		id: string;
		username: string;
		email: string;
		role: string;
		cefrLevel: string;
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
			cefrLevel: user.cefrLevel
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
					cefrLevel: editingUser.cefrLevel
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
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="admin-container">
	<header class="admin-header">
		<h1>Admin Dashboard</h1>
		<p>Manage users and system configuration.</p>
	</header>

	<section class="seed-card">
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

	<section class="seed-card">
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

	<section class="users-section">
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
							<td>{user.cefrLevel}</td>
							<td>{new Date(user.createdAt).toLocaleDateString()}</td>
							<td>{new Date(user.lastActive).toLocaleString()}</td>
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

				<div class="form-row">
					<div class="form-group">
						<label for="edit-role">Role</label>
						<select id="edit-role" bind:value={editingUser.role}>
							<option value="USER">USER</option>
							<option value="ADMIN">ADMIN</option>
						</select>
					</div>

					<div class="form-group">
						<label for="edit-cefr">CEFR Level</label>
						<select id="edit-cefr" bind:value={editingUser.cefrLevel}>
							<option value="A1">A1</option>
							<option value="A2">A2</option>
							<option value="B1">B1</option>
							<option value="B2">B2</option>
							<option value="C1">C1</option>
							<option value="C2">C2</option>
						</select>
					</div>
				</div>

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
		color: #111827;
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

	.seed-card {
		background: #ffffff;
		border: 1px solid #e5e7eb;
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
		color: #111827;
		margin: 0 0 0.25rem 0;
	}

	.seed-info p {
		color: #6b7280;
		font-size: 0.875rem;
		margin: 0;
	}

	.seed-btn {
		background-color: #2563eb;
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
		background-color: #1d4ed8;
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
		color: #111827;
		margin: 0 0 1rem 0;
	}

	.table-wrapper {
		background: #ffffff;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	thead {
		background-color: #f9fafb;
	}

	th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
	}

	td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		color: #4b5563;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover td {
		background-color: #f9fafb;
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
		background: #ffffff;
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
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		color: #111827;
		background: #ffffff;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
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
		background-color: #2563eb;
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
		background-color: #1d4ed8;
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
</style>