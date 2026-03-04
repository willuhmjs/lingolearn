<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { SvelteToast } from '@zerodevx/svelte-toast';

	let { data, children } = $props();
	let user = $derived(data.user);
</script>

<SvelteToast />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>LernenDeutsch</title>
</svelte:head>

<div class="app-container">
	<header>
		<nav class="navbar">
			<a href="/" class="brand">
				<svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
				LernenDeutsch
			</a>
			<div class="nav-links">
				{#if user}
					<a href="/dashboard" class="nav-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
						Dashboard
					</a>
					<a href="/play" class="nav-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
						Play
					</a>
					<a href="/onboarding" class="nav-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
						Onboarding
					</a>
					<a href="/profile" class="nav-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
						Profile
					</a>
					{#if user.role === 'ADMIN'}
						<a href="/admin" class="nav-item admin-link">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
							Admin
						</a>
					{/if}
					<div class="nav-divider"></div>
					<form action="/logout" method="POST" class="logout-form">
						<button type="submit" class="logout-btn">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
							Logout
						</button>
					</form>
				{:else}
					<a href="/login" class="nav-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						Login
					</a>
					<a href="/signup" class="nav-item signup-link">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
						Sign Up
					</a>
				{/if}
			</div>
		</nav>
	</header>

	<main class="main-content">
		{@render children()}
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
		background-color: var(--bg-color, #f9fafb);
		color: var(--text-color, #111827);
		transition: background-color 0.3s, color 0.3s;
	}

	:global(html[data-theme="dark"]) {
		--bg-color: #111827;
		--text-color: #f9fafb;
		--header-bg: #1f2937;
		--header-border: #374151;
		--card-bg: #1f2937;
		--card-border: #374151;
		--link-color: #d1d5db;
		--link-hover-bg: #374151;
		--brand-color: #60a5fa;
		--input-bg: #374151;
		--input-border: #4b5563;
		--input-text: #f9fafb;
	}

	:global(html[data-theme="bavarian"]) {
		--bg-color: #f4ecd8;
		--text-color: #3e2723;
		--header-bg: #eaddc0;
		--header-border: #c8b79b;
		--card-bg: #fff8eb;
		--card-border: #d7ccc8;
		--link-color: #5d4037;
		--link-hover-bg: #d7ccc8;
		--brand-color: #8d6e63;
		--input-bg: #fff8eb;
		--input-border: #a1887f;
		--input-text: #3e2723;
		font-family: "Georgia", serif;
	}

	:global(html[data-theme="dark"] .info-card),
	:global(html[data-theme="dark"] .password-card),
	:global(html[data-theme="dark"] .theme-card),
	:global(html[data-theme="dark"] .card) {
		background: var(--card-bg) !important;
		border-color: var(--card-border) !important;
	}

	:global(html[data-theme="dark"] h1),
	:global(html[data-theme="dark"] h2),
	:global(html[data-theme="dark"] h3),
	:global(html[data-theme="dark"] .info-value) {
		color: var(--text-color) !important;
	}

	:global(html[data-theme="dark"] input),
	:global(html[data-theme="dark"] select) {
		background: var(--input-bg) !important;
		border-color: var(--input-border) !important;
		color: var(--input-text) !important;
	}

	:global(html[data-theme="bavarian"] .info-card),
	:global(html[data-theme="bavarian"] .password-card),
	:global(html[data-theme="bavarian"] .theme-card),
	:global(html[data-theme="bavarian"] .card) {
		background: var(--card-bg) !important;
		border-color: var(--card-border) !important;
	}

	:global(html[data-theme="bavarian"] h1),
	:global(html[data-theme="bavarian"] h2),
	:global(html[data-theme="bavarian"] h3),
	:global(html[data-theme="bavarian"] .info-value) {
		color: var(--text-color) !important;
	}

	:global(html[data-theme="bavarian"] input),
	:global(html[data-theme="bavarian"] select) {
		background: var(--input-bg) !important;
		border-color: var(--input-border) !important;
		color: var(--input-text) !important;
	}

	.app-container {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	header {
		background-color: var(--header-bg, #ffffff);
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
		border-bottom: 1px solid var(--header-border, transparent);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.navbar {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0.75rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.brand {
		font-size: 1.35rem;
		font-weight: 700;
		color: #2563eb;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.brand-icon {
		width: 1.5rem;
		height: 1.5rem;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		text-decoration: none;
		color: #4b5563;
		font-weight: 500;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		transition: color 0.15s, background-color 0.15s;
	}

	.nav-item:hover {
		color: #111827;
		background-color: #f3f4f6;
	}

	.nav-item svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.nav-divider {
		width: 1px;
		height: 1.25rem;
		background-color: #e5e7eb;
		margin: 0 0.25rem;
	}

	.signup-link {
		background-color: #2563eb;
		color: #ffffff !important;
		font-weight: 600;
	}

	.signup-link:hover {
		background-color: #1d4ed8 !important;
		color: #ffffff !important;
	}

	.logout-form {
		margin: 0;
	}

	.logout-btn {
		background: none;
		border: none;
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #ef4444;
		cursor: pointer;
		font-family: inherit;
		transition: color 0.15s, background-color 0.15s;
	}

	.logout-btn svg {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.logout-btn:hover {
		color: #dc2626;
		background-color: #fef2f2;
	}

	.admin-link {
		color: #7c3aed !important;
	}

	.admin-link:hover {
		color: #6d28d9 !important;
		background-color: #f5f3ff !important;
	}

	.main-content {
		flex: 1;
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		width: 100%;
		box-sizing: border-box;
	}
</style>
