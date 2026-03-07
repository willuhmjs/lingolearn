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
	<nav class="sidebar">
		<div class="sidebar-header">
			<a href="/" class="brand">
				<svg class="brand-icon animate-float" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
				<span class="brand-text">LingoLearn</span>
			</a>
		</div>

		<div class="nav-links">
			{#if user}
				<a href="/dashboard" class="nav-item {$page.url.pathname.startsWith('/dashboard') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
					<span class="nav-text">Dashboard</span>
				</a>
				<a href="/play" class="nav-item {$page.url.pathname.startsWith('/play') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
					<span class="nav-text">Play</span>
				</a>
				<a href="/classes" class="nav-item {$page.url.pathname.startsWith('/classes') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
					<span class="nav-text">Classes</span>
				</a>
				<a href="/dictionary" class="nav-item {$page.url.pathname.startsWith('/dictionary') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
					<span class="nav-text">Dictionary</span>
				</a>
				<a href="/practice/chat" class="nav-item {$page.url.pathname.startsWith('/practice/chat') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
					<span class="nav-text">Chat</span>
				</a>
				<a href="/review" class="nav-item {$page.url.pathname.startsWith('/review') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
					<span class="nav-text">Review</span>
				</a>
				<a href="/onboarding" class="nav-item {$page.url.pathname.startsWith('/onboarding') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
					<span class="nav-text">Onboarding</span>
				</a>
				<a href="/profile" class="nav-item {$page.url.pathname.startsWith('/profile') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
					<span class="nav-text">Profile</span>
				</a>
				{#if user.role === 'ADMIN'}
					<a href="/admin" class="nav-item admin-link {$page.url.pathname.startsWith('/admin') ? 'active' : ''}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
						<span class="nav-text">Admin</span>
					</a>
				{/if}
			{:else}
				<a href="/login" class="nav-item {$page.url.pathname.startsWith('/login') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
					<span class="nav-text">Login</span>
				</a>
				<a href="/signup" class="nav-item signup-link {$page.url.pathname.startsWith('/signup') ? 'active' : ''}">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
					<span class="nav-text">Sign Up</span>
				</a>
			{/if}
		</div>

		{#if user}
			<div class="sidebar-footer">
				{#if languages.length > 0}
					<div class="language-dropdown-container">
						<button class="nav-item language-selector-btn" onclick={toggleDropdown}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
							<span class="active-lang-text nav-text">
								{#if user?.activeLanguage}
									{user.activeLanguage.flag ? user.activeLanguage.flag + ' ' : ''}{user.activeLanguage.name}
								{:else}
									Language
								{/if}
							</span>
							<svg class="dropdown-chevron nav-text {isDropdownOpen ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
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

				<form action="/logout" method="POST" class="logout-form">
					<button type="submit" class="logout-btn nav-item">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
						<span class="nav-text">Logout</span>
					</button>
				</form>
			</div>
		{/if}
	</nav>

	<div class="content-wrapper">
		<header class="mobile-header">
			<a href="/" class="mobile-brand">
				<svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
				<span class="brand-text">LingoLearn</span>
			</a>
			{#if user}
				<div class="gamification-stats">
					<span class="stat streak" title="Current Streak">
						🔥 {user.currentStreak || 0}
					</span>
					<span class="stat xp" title="Total XP">
						⚡ {user.totalXp || 0} XP
					</span>
				</div>
			{/if}
		</header>

		<main class="main-content">
			{@render children()}
		</main>

		<footer class="site-footer">
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

	.app-container {
		display: flex;
		min-height: 100vh;
	}

	.sidebar {
		width: 250px;
		background-color: var(--header-bg, #ffffff);
		border-right: 2px solid var(--header-border, #e5e7eb);
		display: flex;
		flex-direction: column;
		position: fixed;
		top: 0;
		left: 0;
		height: 100vh;
		z-index: 50;
		padding: 1.5rem 1rem;
		box-sizing: border-box;
		overflow-y: auto;
	}

	.sidebar-header {
		margin-bottom: 2rem;
		display: flex;
		justify-content: center;
	}

	.brand {
		font-size: 1.5rem;
		font-weight: 800;
		color: #2563eb;
		text-decoration: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.brand-icon {
		width: 2rem;
		height: 2rem;
	}

	.nav-links {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		text-decoration: none;
		color: #4b5563;
		font-weight: 700;
		font-size: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 1rem;
		transition: transform 0.1s, box-shadow 0.1s, color 0.15s, background-color 0.15s;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: 100%;
		box-sizing: border-box;
	}

	.nav-item:hover, .nav-item.active {
		color: #1cb0f6;
		background-color: #ddf4ff;
	}

	.nav-item:active {
		transform: scale(0.98);
	}

	.nav-item svg {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
	}

	.sidebar-footer {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 2px solid var(--header-border, #e5e7eb);
	}

	.language-dropdown-container {
		position: relative;
		width: 100%;
	}

	.language-selector-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		text-align: left;
	}

	.active-lang-text {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dropdown-chevron {
		width: 1.25rem !important;
		height: 1.25rem !important;
		transition: transform 0.2s ease;
		margin-left: auto;
	}

	.dropdown-chevron.open {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		bottom: calc(100% + 0.5rem);
		left: 0;
		background-color: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1rem;
		box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06), 0 4px 0 var(--card-border, #e5e7eb);
		padding: 0.5rem;
		width: 100%;
		box-sizing: border-box;
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
		width: 100%;
	}

	.logout-btn {
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		color: #ff4b4b;
		text-align: left;
	}

	.logout-btn:hover {
		color: #ea2b2b;
		background-color: #ffedef;
	}

	.admin-link {
		color: #7c3aed !important;
	}

	.admin-link:hover, .admin-link.active {
		color: #6d28d9 !important;
		background-color: #f5f3ff !important;
	}

	.content-wrapper {
		flex: 1;
		margin-left: 250px;
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.mobile-header {
		display: none;
	}

	.mobile-brand {
		display: none;
	}

	.gamification-stats {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background-color: var(--card-bg, #f3f4f6);
		padding: 0.5rem 1rem;
		border-radius: 1rem;
		border: 2px solid var(--card-border, #e5e7eb);
	}

	.gamification-stats .stat {
		font-size: 1rem;
		font-weight: 800;
		color: var(--text-color, #374151);
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.gamification-stats .streak {
		color: #f97316;
	}

	.gamification-stats .xp {
		color: #3b82f6;
	}

	.main-content {
		flex: 1;
		width: 100%;
		box-sizing: border-box;
	}

	.site-footer {
		padding: 1.5rem 1rem;
		text-align: center;
		font-size: 0.85rem;
		color: #9ca3af;
		border-top: 1px solid var(--card-border, #e5e7eb);
		margin-top: auto;
	}

	.footer-content {
		max-width: 1024px;
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

	/* Responsive Design for smaller screens */
	@media (max-width: 768px) {
		.app-container {
			flex-direction: column;
		}

		.sidebar {
			position: fixed;
			bottom: 0;
			top: auto;
			left: 0;
			width: 100%;
			height: auto;
			flex-direction: row;
			padding: 0.5rem;
			border-right: none;
			border-top: 2px solid var(--header-border, #e5e7eb);
			z-index: 100;
			justify-content: space-around;
			align-items: center;
		}

		.sidebar-header {
			display: none;
		}

		.nav-links {
			flex-direction: row;
			justify-content: space-around;
			width: 100%;
			gap: 0;
		}

		.nav-item {
			padding: 0.5rem;
			justify-content: center;
			flex-direction: column;
			gap: 0.25rem;
			font-size: 0.7rem;
			border-radius: 0.5rem;
		}

		.nav-text {
			display: none; /* Hide text on very small screens, keep icons */
		}

		.sidebar-footer {
			display: none; /* Hide language selector and logout on bottom mobile nav */
		}

		.content-wrapper {
			margin-left: 0;
			margin-bottom: 70px; /* Space for bottom nav */
		}

		.mobile-header {
			display: flex;
			justify-content: flex-end;
			align-items: center;
			padding: 1rem;
			border-bottom: 2px solid var(--header-border, #e5e7eb);
			background-color: var(--header-bg, #ffffff);
			position: sticky;
			top: 0;
			z-index: 50;
		}

		.mobile-brand {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			font-size: 1.25rem;
			font-weight: 800;
			color: #2563eb;
			text-decoration: none;
			position: absolute;
			left: 50%;
			transform: translateX(-50%);
		}

		.mobile-brand .brand-icon {
			width: 1.5rem;
			height: 1.5rem;
		}

		.mobile-brand .brand-text {
			display: inline;
		}

		.gamification-stats {
			padding: 0.375rem 0.75rem;
		}

		.main-content {
			padding: 0;
		}
	}
	
	@media (min-width: 769px) and (max-width: 1024px) {
		.sidebar {
			width: 80px;
			padding: 1rem 0.5rem;
		}
		
		.brand-text, .nav-text {
			display: none;
		}
		
		.nav-item {
			justify-content: center;
			padding: 0.75rem;
		}
		
		.nav-item svg {
			margin: 0;
		}
		
		.content-wrapper {
			margin-left: 80px;
		}
		
		.dropdown-menu {
			left: 100%;
			bottom: 0;
			margin-left: 0.5rem;
		}
	}
</style>
