<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { fly } from 'svelte/transition';
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data: PageData;

	let createName = '';
	let createDescription = '';
	let isCreating = false;
	let createError = '';

	let joinCode = '';
	let isJoining = false;
	let joinError = '';

	onMount(() => {
		const codeParam = $page.url.searchParams.get('code');
		if (codeParam) {
			joinCode = codeParam;
		}
	});

	async function handleCreate() {
		if (!createName) return;
		isCreating = true;
		createError = '';

		try {
			const res = await fetch('/api/classes/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: createName, description: createDescription })
			});
			const result = await res.json();
			if (!res.ok) {
				createError = result.error || 'Failed to create class';
			} else {
				createName = '';
				createDescription = '';
				await invalidateAll();
			}
		} catch (e) {
			createError = 'An error occurred';
		} finally {
			isCreating = false;
		}
	}

	async function handleJoin() {
		if (!joinCode) return;
		isJoining = true;
		joinError = '';

		try {
			const res = await fetch('/api/classes/join', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ inviteCode: joinCode })
			});
			const result = await res.json();
			if (!res.ok) {
				joinError = result.error || 'Failed to join class';
			} else {
				joinCode = '';
				await invalidateAll();
			}
		} catch (e) {
			joinError = 'An error occurred';
		} finally {
			isJoining = false;
		}
	}
</script>

<svelte:head>
	<title>My Classes - LingoLearn</title>
</svelte:head>

<div class="classes-container">
	<header class="classes-header" in:fly={{ y: 20, duration: 400 }}>
		<h1>Classes</h1>
		<p>Join a learning community or create your own.</p>
	</header>

	<div class="forms-grid" in:fly={{ y: 20, duration: 400, delay: 100 }}>
		<!-- Create Class Form -->
		<div class="card-duo form-card">
			<h2>Create a Class</h2>
			<form on:submit|preventDefault={handleCreate} class="form-inner">
				<div class="field">
					<label for="name">Class Name</label>
					<input
						type="text"
						id="name"
						bind:value={createName}
						placeholder="e.g. German 101"
						required
					/>
				</div>
				<div class="field">
					<label for="description">Description (Optional)</label>
					<textarea
						id="description"
						bind:value={createDescription}
						placeholder="What is this class about?"
						rows="3"
					></textarea>
				</div>
				{#if createError}
					<p class="form-error">{createError}</p>
				{/if}
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

		<!-- Join Class Form -->
		<div class="card-duo form-card">
			<h2>Join a Class</h2>
			<form on:submit|preventDefault={handleJoin} class="form-inner">
				<div class="field">
					<label for="inviteCode">Invite Code</label>
					<input
						type="text"
						id="inviteCode"
						bind:value={joinCode}
						placeholder="Enter 6-character code"
						class="invite-code-input"
						maxlength="6"
						required
					/>
				</div>
				{#if joinError}
					<p class="form-error">{joinError}</p>
				{/if}
				<div class="form-actions">
					<button
						type="submit"
						disabled={isJoining || !joinCode}
						class="btn-duo btn-success btn-full"
					>
						{isJoining ? 'Joining...' : 'Join Class'}
					</button>
				</div>
			</form>
		</div>
	</div>

	<!-- List of Classes -->
	<section class="my-classes-section" in:fly={{ y: 20, duration: 400, delay: 200 }}>
		<h2 class="section-title">My Classes</h2>

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
									<path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
								</svg>
								{cls.members.length} members
							</span>
							<span class="meta-item">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H7z" clip-rule="evenodd" />
								</svg>
								{cls.assignments.length} tasks
							</span>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
				<p class="empty-title">No classes yet</p>
				<p class="empty-desc">Create a new class or join one using an invite code!</p>
			</div>
		{/if}
	</section>
</div>

<style>
	:global(.btn-success) {
		background-color: #22c55e;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #16a34a;
	}
	:global(.btn-success:hover) {
		background-color: #4ade80;
		transform: scale(1.02);
	}
	:global(.btn-success:active) {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #16a34a;
	}

	:global(.btn-full) {
		width: 100%;
	}

	.classes-container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.classes-header {
		text-align: center;
		margin-bottom: 2.5rem;
	}

	.classes-header h1 {
		font-size: 2.5rem;
		color: var(--text-color, #0f172a);
		margin: 0 0 0.5rem;
	}

	.classes-header p {
		color: #64748b;
		font-size: 1.1rem;
		margin: 0;
	}

	.forms-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
		margin-bottom: 3rem;
	}

	@media (min-width: 768px) {
		.forms-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.form-card {
		display: flex;
		flex-direction: column;
	}

	.form-card h2 {
		font-size: 1.5rem;
		color: var(--text-color, #1e293b);
		margin: 0 0 1.5rem;
		border: none;
		padding: 0;
	}

	.form-inner {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
		gap: 1.25rem;
	}

	.field label {
		display: block;
		font-size: 0.8rem;
		font-weight: 800;
		color: #475569;
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.field input,
	.field textarea {
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 1rem;
		border: 2px solid var(--card-border, #e5e7eb);
		background-color: var(--input-bg, #ffffff);
		color: var(--text-color, #1e293b);
		font-family: inherit;
		font-size: 1rem;
		font-weight: 700;
		transition: border-color 0.2s;
		box-sizing: border-box;
		outline: none;
	}

	.field input:focus,
	.field textarea:focus {
		border-color: #3b82f6;
	}

	.field textarea {
		resize: none;
	}

	.invite-code-input {
		text-align: center;
		font-size: 1.5rem !important;
		font-weight: 900 !important;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	.form-error {
		background-color: #fef2f2;
		color: #ef4444;
		font-weight: 700;
		font-size: 0.875rem;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		border: 2px solid #fecaca;
		margin: 0;
	}

	.form-actions {
		margin-top: auto;
		padding-top: 0.5rem;
	}

	.my-classes-section {
		margin-top: 1rem;
	}

	.section-title {
		font-size: 1.75rem;
		color: var(--text-color, #0f172a);
		margin: 0 0 1.5rem;
		border-bottom: 2px solid var(--card-border, #e2e8f0);
		padding-bottom: 0.5rem;
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

	@media (min-width: 1024px) {
		.classes-grid {
			grid-template-columns: 1fr 1fr 1fr;
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
		padding: 3rem 2rem;
		background: var(--card-bg, #f8fafc);
		border-radius: 1.5rem;
		border: 3px dashed var(--card-border, #cbd5e1);
		color: #94a3b8;
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

	.empty-desc {
		color: #94a3b8;
		margin: 0;
		font-size: 0.95rem;
	}
</style>
