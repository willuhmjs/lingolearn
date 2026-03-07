<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-french-toast';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';

	let { data, children } = $props();
	let user = $derived(data.user);
	let languages = $derived(data.languages || []);
	let isDropdownOpen = $state(false);

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	function closeDropdown(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.language-dropdown-container')) {
			isDropdownOpen = false;
		}
	}

	async function changeLanguage(languageId: string) {
		isDropdownOpen = false;
		try {
			const res = await fetch('/api/user/active-language', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ languageId })
			});

			if (res.ok) {
				await invalidateAll();
			} else {
				console.error('Failed to change language');
			}
		} catch (error) {
			console.error('Error changing language:', error);
		}
	}
</script>

<svelte:window onclick={closeDropdown} />

<Toaster />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>LingoLearn</title>
	<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
</svelte:head>

<div class="app-container">
	<header>
		<nav class="navbar">
			<a href="/" class="brand">
				<svg class="brand-icon animate-float" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
				LingoLearn
			</a>
			<div class="nav-links">
				{#if user}
					<a href="/dashboard" class="nav-item {$page.url.pathname.startsWith('/dashboard') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
						Dashboard
					</a>
					<a href="/play" class="nav-item {$page.url.pathname.startsWith('/play') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
						Play
					</a>
					<a href="/classes" class="nav-item {$page.url.pathname.startsWith('/classes') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
						Classes
					</a>
					<a href="/dictionary" class="nav-item {$page.url.pathname.startsWith('/dictionary') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
						Dictionary
					</a>
					<a href="/onboarding" class="nav-item {$page.url.pathname.startsWith('/onboarding') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
						Onboarding
					</a>
					<a href="/profile" class="nav-item {$page.url.pathname.startsWith('/profile') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
						Profile
					</a>
					{#if user.role === 'ADMIN'}
						<a href="/admin" class="nav-item admin-link {$page.url.pathname.startsWith('/admin') ? 'active' : ''}">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
							Admin
						</a>
					{/if}
					
					<div class="gamification-stats">
						<span class="stat streak" title="Current Streak">
							🔥 {user.currentStreak || 0}
						</span>
						<span class="stat xp" title="Total XP">
							⚡ {user.totalXp || 0} XP
						</span>
					</div>

					{#if languages.length > 0}
						<div class="language-dropdown-container">
							<button class="nav-item language-selector-btn" onclick={toggleDropdown}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
								<span class="active-lang-text">
									{#if user?.activeLanguage}
										{user.activeLanguage.flag ? user.activeLanguage.flag + ' ' : ''}{user.activeLanguage.name}
									{:else}
										Language
									{/if}
								</span>
								<svg class="dropdown-chevron {isDropdownOpen ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
							</button>

							{#if isDropdownOpen}
								<div class="dropdown-menu">
									{#each languages as lang}
										<button 
											class="dropdown-item {user?.activeLanguage?.id === lang.id ? 'active' : ''}"
											onclick={() => changeLanguage(lang.id)}
										>
											<span class="lang-flag">{lang.flag || ''}</span>
											<span class="lang-name">{lang.name}</span>
											{#if user?.activeLanguage?.id === lang.id}
												<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<div class="nav-divider"></div>
					<form action="/logout" method="POST" class="logout-form">
						<button type="submit" class="logout-btn">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
							Logout
						</button>
					</form>
				{:else}
					<a href="/login" class="nav-item {$page.url.pathname.startsWith('/login') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
						Login
					</a>
					<a href="/signup" class="nav-item signup-link {$page.url.pathname.startsWith('/signup') ? 'active' : ''}">
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

	<footer class="site-footer dark:text-slate-400">
		<div class="footer-content">
			<span class="footer-brand">© {new Date().getFullYear()} LingoLearn</span>
			<nav class="footer-links">
				<a href="/privacy">Privacy Policy</a>
				<span class="footer-dot">·</span>
				<a href="/terms">Terms of Service</a>
			</nav>
		</div>
	</footer>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Nunito', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
		background-color: var(--bg-color, #ffffff);
		color: var(--text-color, #374151);
		transition: background-color 0.3s, color 0.3s;
	}

	:global(h1, h2, h3, h4, h5, h6) {
		font-weight: 800;
	}

	:global(.btn-duo) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.5rem;
		font-weight: 800;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: 1rem;
		border: 2px solid transparent;
		transition: transform 0.1s, box-shadow 0.1s;
		cursor: pointer;
		text-decoration: none;
		outline: none;
	}

	:global(.btn-primary) {
		background-color: #22c55e;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #16a34a;
	}
	:global(.btn-primary:hover) {
		background-color: #4ade80;
		transform: scale(1.02);
	}
	:global(.btn-primary:active) {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #16a34a;
	}

	:global(.btn-secondary) {
		background-color: #64748b;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #475569;
	}
	:global(.btn-secondary:hover) {
		background-color: #94a3b8;
		transform: scale(1.02);
	}
	:global(.btn-secondary:active) {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #475569;
	}

	:global(.btn-danger) {
		background-color: #ef4444;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #dc2626;
	}
	:global(.btn-danger:hover) {
		background-color: #f87171;
		transform: scale(1.02);
	}
	:global(.btn-danger:active) {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #dc2626;
	}

	:global(.card-duo) {
		background-color: white;
		border: 2px solid #e5e7eb;
		border-radius: 1.5rem;
		padding: 1.5rem;
		box-shadow: 0 4px 0 #e5e7eb;
		transition: transform 0.2s, box-shadow 0.2s;
	}
	
	:global(.card-duo:hover) {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #e5e7eb;
	}

	@keyframes float {
		0% { transform: translateY(0px); }
		50% { transform: translateY(-4px); }
		100% { transform: translateY(0px); }
	}

	:global(.animate-float) {
		animation: float 3s ease-in-out infinite;
	}

	@keyframes bounce-subtle {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-10%); }
	}

	:global(.animate-bounce-subtle) {
		animation: bounce-subtle 1s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
		50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
	}

	:global(.animate-pulse-glow) {
		animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
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

	:global(html[data-theme="dark"] .dark\:bg-slate-800) {
		background-color: #1e293b !important;
	}
	:global(html[data-theme="dark"] .dark\:bg-slate-900) {
		background-color: #0f172a !important;
	}
	:global(html[data-theme="dark"] .dark\:text-white) {
		color: #ffffff !important;
	}
	:global(html[data-theme="dark"] .dark\:text-slate-200) {
		color: #e2e8f0 !important;
	}
	:global(html[data-theme="dark"] .dark\:text-slate-300) {
		color: #cbd5e1 !important;
	}
	:global(html[data-theme="dark"] .dark\:text-slate-400) {
		color: #94a3b8 !important;
	}
	:global(html[data-theme="dark"] .dark\:border-slate-700) {
		border-color: #334155 !important;
	}
	:global(html[data-theme="dark"] .dark\:border-slate-600) {
		border-color: #475569 !important;
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
		max-width: 1536px;
		margin: 0 auto;
		padding: 0.75rem 1rem;
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
		font-weight: 700;
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		border-radius: 1rem;
		transition: transform 0.1s, box-shadow 0.1s, color 0.15s, background-color 0.15s;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.nav-item:hover, .nav-item.active {
		color: #1cb0f6;
		background-color: #ddf4ff;
	}
	.nav-item:active {
		transform: scale(0.98);
	}

	.nav-item svg {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.nav-divider {
		width: 2px;
		height: 1.5rem;
		background-color: #e5e7eb;
		margin: 0 0.5rem;
		border-radius: 1px;
	}

	.gamification-stats {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background-color: var(--card-bg, #f3f4f6);
		padding: 0.375rem 0.75rem;
		border-radius: 1rem;
		border: 1px solid var(--card-border, #e5e7eb);
	}

	.gamification-stats .stat {
		font-size: 0.875rem;
		font-weight: 800;
		color: var(--text-color, #374151);
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.gamification-stats .streak {
		color: #f97316;
	}

	.gamification-stats .xp {
		color: #3b82f6;
	}

	.language-dropdown-container {
		position: relative;
	}

	.language-selector-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
	}

	.active-lang-text {
		font-weight: 700;
	}

	.dropdown-chevron {
		width: 1rem !important;
		height: 1rem !important;
		transition: transform 0.2s ease;
		margin-left: 0.25rem;
	}

	.dropdown-chevron.open {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		background-color: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 4px 0 var(--card-border, #e5e7eb);
		padding: 0.5rem;
		min-width: 180px;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		background: transparent;
		cursor: pointer;
		font-family: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--text-color, #374151);
		border-radius: 0.75rem;
		text-align: left;
		transition: background-color 0.15s, color 0.15s;
	}

	.dropdown-item:hover, .dropdown-item.active {
		background-color: #ddf4ff;
		color: #1cb0f6;
	}

	.lang-flag {
		font-size: 1.25rem;
	}

	.lang-name {
		flex: 1;
	}

	.check-icon {
		width: 1.25rem !important;
		height: 1.25rem !important;
		color: #1cb0f6;
	}

	.signup-link {
		background-color: #22c55e;
		color: #ffffff !important;
		font-weight: 800;
		box-shadow: 0 4px 0 #16a34a;
		border-radius: 1rem;
		margin-left: 0.5rem;
	}

	.signup-link:hover {
		background-color: #4ade80 !important;
		color: #ffffff !important;
	}
	
	.signup-link:active {
		transform: translateY(2px);
		box-shadow: 0 2px 0 #16a34a;
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
		border-radius: 1rem;
		font-size: 0.875rem;
		font-weight: 700;
		color: #ff4b4b;
		cursor: pointer;
		font-family: inherit;
		transition: transform 0.1s, color 0.15s, background-color 0.15s;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.logout-btn svg {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	.logout-btn:hover {
		color: #ea2b2b;
		background-color: #ffedef;
	}
	.logout-btn:active {
		transform: scale(0.98);
	}

	.admin-link {
		color: #7c3aed !important;
	}

	.admin-link:hover, .admin-link.active {
		color: #6d28d9 !important;
		background-color: #f5f3ff !important;
	}

	.main-content {
		flex: 1;
		max-width: 1536px;
		margin: 0 auto;
		padding: 2rem 1rem;
		width: 100%;
		box-sizing: border-box;
	}

	.site-footer {
		padding: 1.5rem 1rem;
		text-align: center;
		font-size: 0.85rem;
		color: #9ca3af;
		border-top: 1px solid var(--card-border, #e5e7eb);
	}

	.footer-content {
		max-width: 1536px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.footer-brand {
		font-weight: 600;
	}

	.footer-links {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.footer-links a {
		color: #6b7280;
		text-decoration: none;
		transition: color 0.15s;
	}

	.footer-links a:hover {
		color: #4f46e5;
		text-decoration: underline;
	}

	.footer-dot {
		color: #d1d5db;
	}
</style>
