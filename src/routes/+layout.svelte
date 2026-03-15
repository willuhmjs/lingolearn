<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { Toaster } from 'svelte-french-toast';
	import Modal from '$lib/components/Modal.svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { onMount } from 'svelte';

	let { data, children } = $props();
	let user = $derived(data.user);
	let languages = $derived(data.languages || []);
	let isDropdownOpen = $state(false);
	let theme = $state('light');

	onMount(() => {
		const savedTheme = localStorage.getItem('app-theme');
		if (savedTheme) {
			theme = savedTheme;
		} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
			theme = 'dark';
		}
		document.documentElement.setAttribute('data-theme', theme);
	});

	function cycleTheme() {
		if (theme === 'light') theme = 'dark';
		else theme = 'light';

		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('app-theme', theme);
	}

	function toggleDropdown() {
		isDropdownOpen = !isDropdownOpen;
	}

	function closeDropdown(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.language-dropdown-container')) {
			isDropdownOpen = false;
		}
	}

	// Pages that require the user to have onboarded for the active language.
	// If the user switches to an unonboarded language while on one of these,
	// they get redirected to /onboarding.
	const ONBOARDING_REQUIRED_PATHS = ['/play', '/dictionary', '/classes', '/review'];

	async function changeLanguage(languageId: string) {
		isDropdownOpen = false;
		try {
			const res = await fetch('/api/user/active-language', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ languageId })
			});

			if (!res.ok) {
				console.error('Failed to change language');
				return;
			}

			const result = await res.json();

			// Always invalidate first so the layout re-fetches locals.user with the
			// new active language before any navigation or re-render happens.
			await invalidateAll();

			if (!result.hasOnboarded) {
				const currentPath = $page.url.pathname;
				const onRestrictedPage = ONBOARDING_REQUIRED_PATHS.some((p) => currentPath.startsWith(p));
				if (onRestrictedPage) {
					// Use replaceState so the onboarding page is treated as a fresh navigation
					// even if we're already on /onboarding.
					await goto('/onboarding', { replaceState: true, invalidateAll: true });
				}
				// If not on a restricted page (e.g. home, profile), invalidateAll above is enough.
			}
			// If already onboarded for the new language, invalidateAll above is all we need.
		} catch (error) {
			console.error('Error changing language:', error);
		}
	}
</script>

<svelte:window onclick={closeDropdown} />

<Toaster />
<Modal />

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>LingoLearn</title>
	<link
		href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="app-container"
	class:no-sidebar={$page.url.pathname === '/' ||
		$page.url.pathname === '/login' ||
		$page.url.pathname === '/signup'}
>
	{#if $page.url.pathname !== '/' && $page.url.pathname !== '/login' && $page.url.pathname !== '/signup'}
		<nav class="sidebar">
			<div class="sidebar-header">
				<a href="/" class="brand">
					<svg
						class="brand-icon animate-float"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path
							d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
						/></svg
					>
					<span class="brand-text">LingoLearn</span>
				</a>
			</div>

			<div class="nav-links">
				{#if user}
					{#if user.hasOnboarded}
						<a
							href="/dashboard"
							class="nav-item {$page.url.pathname.startsWith('/dashboard') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><rect x="3" y="3" width="7" height="7" rx="1" /><rect
									x="14"
									y="3"
									width="7"
									height="7"
									rx="1"
								/><rect x="3" y="14" width="7" height="7" rx="1" /><rect
									x="14"
									y="14"
									width="7"
									height="7"
									rx="1"
								/></svg
							>
							<span class="nav-text">Dashboard</span>
						</a>
						<a
							href="/play"
							class="nav-item {$page.url.pathname.startsWith('/play') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg
							>
							<span class="nav-text">Play</span>
						</a>
						<a
							href="/classes"
							class="nav-item {$page.url.pathname.startsWith('/classes') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
									cx="9"
									cy="7"
									r="4"
								/><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg
							>
							<span class="nav-text">Classes</span>
						</a>
						<a
							href="/dictionary"
							class="nav-item {$page.url.pathname.startsWith('/dictionary') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path
									d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
								></path></svg
							>
							<span class="nav-text">Dictionary</span>
						</a>
						<a
							href="/review"
							class="nav-item {$page.url.pathname.startsWith('/review') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline
									points="2 17 12 22 22 17"
								></polyline><polyline points="2 12 12 17 22 12"></polyline></svg
							>
							<span class="nav-text">Review</span>
						</a>
					{/if}
					{#if !user.hasOnboarded}
						<a
							href="/onboarding"
							class="nav-item {$page.url.pathname.startsWith('/onboarding') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M12 20h9" /><path
									d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
								/></svg
							>
							<span class="nav-text">Onboarding</span>
						</a>
					{/if}
					{#if user.role === 'ADMIN'}
						<a
							href="/admin"
							class="nav-item admin-link {$page.url.pathname.startsWith('/admin') ? 'active' : ''}"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path
									d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
								/><circle cx="12" cy="12" r="3" /></svg
							>
							<span class="nav-text">Admin</span>
						</a>
					{/if}
				{:else}
					<a
						href="/login"
						class="nav-item {$page.url.pathname.startsWith('/login') ? 'active' : ''}"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline
								points="10 17 15 12 10 7"
							/><line x1="15" y1="12" x2="3" y2="12" /></svg
						>
						<span class="nav-text">Login</span>
					</a>
					<a
						href="/signup"
						class="nav-item signup-link {$page.url.pathname.startsWith('/signup') ? 'active' : ''}"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
								cx="8.5"
								cy="7"
								r="4"
							/><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg
						>
						<span class="nav-text">Sign Up</span>
					</a>
				{/if}
			</div>

			{#if user}
				<div class="sidebar-footer">
					{#if languages.length > 0}
						<div class="language-dropdown-container">
							<button
								class="nav-item language-selector-btn"
								onclick={toggleDropdown}
								aria-label="Select language"
								aria-expanded={isDropdownOpen}
								aria-haspopup="true"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
									><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path
										d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
									/></svg
								>
								<span class="active-lang-text nav-text">
									{#if user?.activeLanguage}
										{user.activeLanguage.flag ? user.activeLanguage.flag + ' ' : ''}{user
											.activeLanguage.name}
									{:else}
										Language
									{/if}
								</span>
								<svg
									class="dropdown-chevron nav-text {isDropdownOpen ? 'open' : ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg
								>
							</button>

							{#if isDropdownOpen}
								<div class="dropdown-menu" role="menu">
									{#each languages as lang}
										<button
											class="dropdown-item {user?.activeLanguage?.id === lang.id ? 'active' : ''}"
											onclick={() => changeLanguage(lang.id)}
											role="menuitem"
											aria-label="Switch to {lang.name}"
										>
											<span class="lang-flag">{lang.flag || ''}</span>
											<span class="lang-name">{lang.name}</span>
											{#if user?.activeLanguage?.id === lang.id}
												<svg
													class="check-icon"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg
												>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}

					<form action="/logout" method="POST" class="logout-form">
						<button type="submit" class="logout-btn nav-item">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline
									points="16 17 21 12 16 7"
								/><line x1="21" y1="12" x2="9" y2="12" /></svg
							>
							<span class="nav-text">Logout</span>
						</button>
					</form>
					<a
						href="/profile"
						class="nav-item {$page.url.pathname.startsWith('/profile') ? 'active' : ''}"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle
								cx="12"
								cy="7"
								r="4"
							/></svg
						>
						<span class="nav-text">Profile</span>
					</a>
				</div>
			{/if}
		</nav>
	{/if}

	<div class="content-wrapper">
		<header class="mobile-header">
			<a href="/" class="mobile-brand">
				<svg
					class="brand-icon"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path
						d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
					/></svg
				>
				<span class="brand-text">LingoLearn</span>
			</a>
			<div class="mobile-header-right">
				{#if user && languages.length > 0}
					<div class="language-dropdown-container mobile-lang-dropdown">
						<button class="mobile-lang-btn" onclick={toggleDropdown} aria-label="Select language">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path
									d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
								/></svg
							>
							<span class="mobile-lang-label">
								{#if user?.activeLanguage}
									{user.activeLanguage.flag ? user.activeLanguage.flag : ''}{user.activeLanguage
										.name}
								{:else}
									Language
								{/if}
							</span>
							<svg
								class="dropdown-chevron {isDropdownOpen ? 'open' : ''}"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg
							>
						</button>

						{#if isDropdownOpen}
							<div class="dropdown-menu mobile-dropdown-menu">
								{#each languages as lang}
									<button
										class="dropdown-item {user?.activeLanguage?.id === lang.id ? 'active' : ''}"
										onclick={() => changeLanguage(lang.id)}
										aria-label="Switch to {lang.name}"
									>
										<span class="lang-flag">{lang.flag || ''}</span>
										<span class="lang-name">{lang.name}</span>
										{#if user?.activeLanguage?.id === lang.id}
											<svg
												class="check-icon"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
												stroke-linejoin="round"
												aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg
											>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				<button
					class="nav-item theme-toggle-btn mobile-theme-toggle"
					onclick={cycleTheme}
					aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
					style="border: none; background: transparent; cursor: pointer; padding: 0.4rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center;"
				>
					{#if theme === 'light'}
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
								x1="12"
								y1="21"
								x2="12"
								y2="23"
							/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
								x1="18.36"
								y1="18.36"
								x2="19.78"
								y2="19.78"
							/><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
								x1="4.22"
								y1="19.78"
								x2="5.64"
								y2="18.36"
							/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg
						>
					{:else}
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg
						>
					{/if}
				</button>
				{#if user}
					<div class="gamification-stats">
						<span class="stat streak" title="Current Streak">
							🔥 {user.currentStreak || 0}
						</span>
						<span class="stat xp" title="Total XP">
							⚡ {user.totalXp || 0} XP
						</span>
					</div>
					<!-- Mobile logout button -->
					<form action="/logout" method="POST" class="mobile-logout-form">
						<button type="submit" class="mobile-logout-btn" aria-label="Logout">
							<svg
								viewBox="0 0 24 24"
								width="20"
								height="20"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
								><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline
									points="16 17 21 12 16 7"
								/><line x1="21" y1="12" x2="9" y2="12" /></svg
							>
						</button>
					</form>
				{/if}
			</div>
		</header>

		<header class="desktop-topbar">
			<button
				class="nav-item theme-toggle-btn"
				onclick={cycleTheme}
				aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
				style="border: none; background: transparent; cursor: pointer; padding: 0.5rem; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; width: auto; height: auto;"
			>
				{#if theme === 'light'}
					<svg
						viewBox="0 0 24 24"
						width="24"
						height="24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line
							x1="12"
							y1="21"
							x2="12"
							y2="23"
						/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line
							x1="18.36"
							y1="18.36"
							x2="19.78"
							y2="19.78"
						/><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line
							x1="4.22"
							y1="19.78"
							x2="5.64"
							y2="18.36"
						/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg
					>
				{:else}
					<svg
						viewBox="0 0 24 24"
						width="24"
						height="24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg
					>
				{/if}
			</button>
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
		font-family:
			'Nunito',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif,
			'Apple Color Emoji',
			'Segoe UI Emoji',
			'Segoe UI Symbol';
		background-color: var(--bg-color, #ffffff);
		color: var(--text-color, #374151);
		transition:
			background-color 0.3s,
			color 0.3s;
	}

	:global(h1, h2, h3, h4, h5, h6) {
		font-weight: 800;
	}

	:global(.btn-duo) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.875rem 1.75rem;
		font-weight: 800;
		font-size: 1rem;
		letter-spacing: 0.025em;
		border-radius: 1rem;
		border: 2px solid transparent;
		transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
		text-decoration: none;
		outline: none;
		user-select: none;
	}

	:global(.btn-primary) {
		background-color: #58cc02;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #58a700;
	}
	:global(.btn-primary:hover) {
		background-color: #61e002;
		filter: brightness(1.05);
	}
	:global(.btn-primary:active) {
		transform: translateY(4px);
		box-shadow: 0 0 0 #58a700;
	}

	:global(.btn-secondary) {
		background-color: #e5e5e5;
		color: #4b5563;
		border-color: transparent;
		box-shadow: 0 4px 0 #c8c8c8;
	}
	:global(.btn-secondary:hover) {
		background-color: #d4d4d4;
	}
	:global(.btn-secondary:active) {
		transform: translateY(4px);
		box-shadow: 0 0 0 #c8c8c8;
	}
	:global(html[data-theme='dark'] .btn-secondary) {
		background-color: #334155;
		color: #cbd5e1;
		box-shadow: 0 4px 0 #1e293b;
	}
	:global(html[data-theme='dark'] .btn-secondary:hover) {
		background-color: #3d4f63;
	}
	:global(html[data-theme='dark'] .btn-secondary:active) {
		box-shadow: 0 0 0 #1e293b;
	}

	:global(.btn-ai) {
		background-color: #ce82ff;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #a561d4;
	}
	:global(.btn-ai:hover) {
		background-color: #d697ff;
		filter: brightness(1.05);
	}
	:global(.btn-ai:active) {
		transform: translateY(4px);
		box-shadow: 0 0 0 #a561d4;
	}

	:global(.btn-danger) {
		background-color: #ff4b4b;
		color: white;
		border-color: transparent;
		box-shadow: 0 4px 0 #ea2b2b;
	}
	:global(.btn-danger:hover) {
		background-color: #ff6666;
		filter: brightness(1.05);
	}
	:global(.btn-danger:active) {
		transform: translateY(4px);
		box-shadow: 0 0 0 #ea2b2b;
	}

	/* ── Standardized back-navigation button ──────────────────────────── */
	:global(.back-nav) {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		margin-bottom: 1rem;
		background: var(--card-bg, #ffffff);
		border: 1px solid var(--card-border, #e2e8f0);
		border-radius: 0.5rem;
		color: var(--text-color, #334155);
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
	}

	:global(.back-nav:hover) {
		background: #f1f5f9;
		border-color: #94a3b8;
	}

	:global(html[data-theme='dark'] .back-nav:hover) {
		background: #2a303c;
		border-color: #64748b;
	}

	:global(.card-duo) {
		background-color: var(--card-bg, #ffffff);
		border: 2px solid var(--card-border, #e5e7eb);
		border-radius: 1.5rem;
		padding: 1.5rem;
		box-shadow: 0 4px 0 var(--card-border, #e5e7eb);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-sizing: border-box;
	}

	:global(.card-duo:hover) {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 var(--card-border, #e5e7eb);
	}

	@keyframes float {
		0% {
			transform: translateY(0px);
		}
		50% {
			transform: translateY(-4px);
		}
		100% {
			transform: translateY(0px);
		}
	}

	:global(.animate-float) {
		animation: float 3s ease-in-out infinite;
	}

	@keyframes bounce-subtle {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10%);
		}
	}

	:global(.animate-bounce-subtle) {
		animation: bounce-subtle 1s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
		}
		50% {
			box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
		}
	}

	:global(.animate-pulse-glow) {
		animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	:global(html[data-theme='dark']) {
		--bg-color: #1a1d23;
		--text-color: #e2e8f0;
		--text-muted: #94a3b8;
		--header-bg: #21252e;
		--header-border: #2d3340;
		--card-bg: #21252e;
		--card-border: #2d3340;
		--link-color: #60a5fa;
		--link-hover-bg: #2a303c;
		--brand-color: #3b82f6;
		--input-bg: #2a303c;
		--input-border: #3a4150;
		--input-text: #e2e8f0;
	}

	:global(html[data-theme='dark'] .info-card),
	:global(html[data-theme='dark'] .password-card),
	:global(html[data-theme='dark'] .theme-card),
	:global(html[data-theme='dark'] .card) {
		background: var(--card-bg) !important;
		border-color: var(--card-border) !important;
	}

	:global(html[data-theme='dark'] h1),
	:global(html[data-theme='dark'] h2),
	:global(html[data-theme='dark'] h3),
	:global(html[data-theme='dark'] .info-value) {
		color: var(--text-color) !important;
	}

	:global(html[data-theme='dark'] input),
	:global(html[data-theme='dark'] select) {
		background: var(--input-bg) !important;
		border-color: var(--input-border) !important;
		color: var(--input-text) !important;
	}

	.app-container {
		display: grid;
		grid-template-columns: 250px 1fr;
		min-height: 100vh;
	}

	.app-container.no-sidebar {
		grid-template-columns: 1fr;
	}

	.sidebar {
		background-color: var(--header-bg, #ffffff);
		border-right: 2px solid var(--header-border, #e5e7eb);
		display: flex;
		flex-direction: column;
		position: sticky;
		top: 0;
		max-height: 100vh;
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
		transition:
			transform 0.1s,
			box-shadow 0.1s,
			color 0.15s,
			background-color 0.15s;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		width: 100%;
		box-sizing: border-box;
	}

	.nav-item:hover,
	.nav-item.active {
		color: #1cb0f6;
		background-color: var(--link-hover-bg, #ddf4ff);
	}

	:global(html[data-theme='dark']) .nav-item:hover,
	:global(html[data-theme='dark']) .nav-item.active {
		color: #60a5fa;
		background-color: #2a303c;
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
		box-shadow:
			0 -4px 6px -1px rgba(0, 0, 0, 0.1),
			0 -2px 4px -1px rgba(0, 0, 0, 0.06),
			0 4px 0 var(--card-border, #e5e7eb);
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
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.dropdown-item:hover,
	.dropdown-item.active {
		background-color: var(--link-hover-bg, #ddf4ff);
		color: #1cb0f6;
	}

	:global(html[data-theme='dark']) .dropdown-item:hover,
	:global(html[data-theme='dark']) .dropdown-item.active {
		background-color: #2a303c;
		color: #60a5fa;
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
		color: #4f46e5 !important;
	}

	.admin-link:hover,
	.admin-link.active {
		color: #4338ca !important;
		background-color: #eef2ff !important;
	}

	.content-wrapper {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.desktop-topbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		padding: 0.5rem 1.5rem;
		gap: 0.5rem;
	}

	.mobile-header {
		display: none;
	}

	.mobile-brand {
		display: none;
	}

	.mobile-lang-dropdown {
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
		color: #fbbf24;
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
		color: #2563eb;
		text-decoration: underline;
	}

	.footer-dot {
		color: #d1d5db;
	}

	/* Responsive Design for smaller screens */
	@media (max-width: 768px) {
		.app-container {
			display: flex;
			flex-direction: column;
		}

		.desktop-topbar {
			display: none;
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
			justify-content: space-between;
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
		}

		.mobile-brand .brand-icon {
			width: 1.5rem;
			height: 1.5rem;
		}

		.mobile-brand .brand-text {
			display: inline;
		}

		.mobile-header-right {
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		.mobile-lang-dropdown {
			display: block;
			position: relative;
		}

		.mobile-lang-btn {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			background: none;
			border: 2px solid var(--card-border, #e5e7eb);
			border-radius: 0.75rem;
			padding: 0.375rem 0.625rem;
			font-family: inherit;
			font-size: 0.8rem;
			font-weight: 700;
			color: var(--text-color, #374151);
			cursor: pointer;
		}

		.mobile-lang-btn svg {
			width: 1.125rem;
			height: 1.125rem;
			flex-shrink: 0;
		}

		.mobile-lang-label {
			white-space: nowrap;
		}

		.mobile-dropdown-menu {
			position: absolute;
			top: calc(100% + 0.5rem);
			right: 0;
			left: auto;
			bottom: auto;
			min-width: 180px;
			box-shadow:
				0 4px 6px -1px rgba(0, 0, 0, 0.1),
				0 2px 4px -1px rgba(0, 0, 0, 0.06);
		}

		.gamification-stats {
			padding: 0.375rem 0.75rem;
		}

		.mobile-logout-form {
			margin: 0;
		}

		.mobile-logout-btn {
			background: none;
			border: 2px solid var(--card-border, #e5e7eb);
			border-radius: 0.75rem;
			padding: 0.375rem 0.625rem;
			cursor: pointer;
			color: #ff4b4b;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.15s;
		}

		.mobile-logout-btn:hover {
			background-color: #ffedef;
			border-color: #ff4b4b;
		}

		:global(html[data-theme='dark']) .mobile-logout-btn {
			border-color: #2d3340;
		}

		:global(html[data-theme='dark']) .mobile-logout-btn:hover {
			background-color: #2a303c;
			border-color: #ff4b4b;
		}

		.main-content {
			padding: 0;
		}
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		.app-container {
			grid-template-columns: 80px 1fr;
		}

		.sidebar {
			width: 100%; /* controlled by grid now */
			padding: 1rem 0.5rem;
		}

		.brand-text,
		.nav-text {
			display: none;
		}

		.nav-item {
			justify-content: center;
			padding: 0.75rem;
		}

		.nav-item svg {
			margin: 0;
		}

		.dropdown-menu {
			left: 100%;
			bottom: 0;
			margin-left: 0.5rem;
		}
	}
</style>
