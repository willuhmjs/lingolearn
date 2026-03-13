<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { fly } from 'svelte/transition';
	import { toastError } from '$lib/utils/toast';
	let { data, form }: { data: { localLoginEnabled: boolean }; form: { error?: string } | null } = $props();

	const errorMessages: Record<string, string> = {
		OAuthAccountNotLinked:
			'An account with this email already exists. Please sign in with your original method.'
	};

	let isGoogleSigningIn = $state(false);
	let isSubmitting = $state(false);

	const urlError = $derived($page.url.searchParams.get('error'));
	const errorMsg = $derived(form?.error || (urlError ? errorMessages[urlError] || urlError : ''));

	// Show error as toast notification
	$effect(() => {
		if (errorMsg) {
			toastError(errorMsg);
		}
	});

	const redirectTo = $derived($page.url.searchParams.get('redirectTo'));
	const validRedirect = $derived(
		redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
			? redirectTo
			: '/dashboard'
	);

	async function handleGoogleSignIn() {
		if (isGoogleSigningIn) return;
		isGoogleSigningIn = true;
		try {
			await signIn('google', { callbackUrl: validRedirect });
		} catch (error) {
			toastError('Failed to sign in with Google');
			isGoogleSigningIn = false;
		}
	}
</script>

<div class="page-container">
	<div class="auth-card" in:fly={{ y: 20, duration: 400 }}>
		<div class="auth-header">
			<h2>Log in to your account</h2>
			<p>Welcome back! Please enter your details.</p>
		</div>

		<div class="google-auth">
			<button
				type="button"
				class="google-btn"
				onclick={handleGoogleSignIn}
				disabled={isGoogleSigningIn}
				aria-label="Sign in with Google"
				aria-busy={isGoogleSigningIn}
			>
				{#if isGoogleSigningIn}
					<span class="spinner" aria-hidden="true"></span>
				{:else}
					<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
						<path
							d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
							fill="#4285F4"
						/>
						<path
							d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
							fill="#34A853"
						/>
						<path
							d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
							fill="#FBBC05"
						/>
						<path
							d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
							fill="#EA4335"
						/>
					</svg>
				{/if}
				{isGoogleSigningIn ? 'Signing in...' : 'Sign in with Google'}
			</button>
		</div>

		{#if data.localLoginEnabled}
			<div class="divider">
				<span>or continue with email</span>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						await update();
						isSubmitting = false;
					};
				}}
				class="auth-form"
				aria-label="Login form"
			>
				<div class="form-group">
					<label for="identifier">Username or Email</label>
					<input
						id="identifier"
						name="identifier"
						type="text"
						required
						disabled={isSubmitting}
						placeholder="Enter your username or email"
						aria-label="Username or Email"
					/>
				</div>

				<div class="form-group">
					<label for="password">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						disabled={isSubmitting}
						placeholder="Enter your password"
						aria-label="Password"
					/>
				</div>

				<button type="submit" class="submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
					{#if isSubmitting}
						<span class="spinner" aria-hidden="true"></span>
					{/if}
					{isSubmitting ? 'Logging in...' : 'Log in'}
				</button>
			</form>

			<div class="auth-footer">
				<p>Need an account? <a href="/signup">Sign up here</a></p>
			</div>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family:
			'Inter',
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			Helvetica,
			Arial,
			sans-serif;
		background-color: var(--bg-color, #f3f4f6);
	}

	.page-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		box-sizing: border-box;
		margin-top: 4rem;
	}

	.auth-card {
		width: 100%;
		max-width: 400px;
		background-color: var(--card-bg, #ffffff);
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		padding: 2.5rem 2rem;
		box-sizing: border-box;
		border: 1px solid var(--card-border, transparent);
	}

	.auth-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.auth-header h2 {
		margin: 0 0 0.5rem;
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--text-color, #111827);
	}

	.auth-header p {
		margin: 0;
		color: #6b7280;
		font-size: 0.95rem;
	}

	:global(html[data-theme='dark']) .auth-header p {
		color: #94a3b8;
	}

	.google-auth {
		margin-bottom: 1.5rem;
	}

	.google-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background-color: var(--card-bg, #ffffff);
		color: var(--text-color, #374151);
		border: 1px solid var(--card-border, #d1d5db);
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease-in-out;
	}

	.google-btn:hover:not(:disabled) {
		background-color: var(--link-hover-bg, #f9fafb);
	}

	.google-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.divider {
		display: flex;
		align-items: center;
		text-align: center;
		margin: 1.5rem 0;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--card-border, #d1d5db);
	}

	.divider span {
		padding: 0 10px;
		color: #6b7280;
		font-size: 0.875rem;
	}

	:global(html[data-theme='dark']) .divider span {
		color: #94a3b8;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	:global(html[data-theme='dark']) .form-group label {
		color: #cbd5e1;
	}

	.form-group input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--input-border, #d1d5db);
		border-radius: 6px;
		font-size: 1rem;
		color: var(--input-text, #111827);
		background-color: var(--input-bg, #ffffff);
		box-sizing: border-box;
		transition:
			border-color 0.15s ease-in-out,
			box-shadow 0.15s ease-in-out;
	}

	.form-group input:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
	}

	.form-group input::placeholder {
		color: #9ca3af;
	}

	.form-group input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background-color: var(--card-border, #f3f4f6);
	}

	.submit-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		background-color: #22c55e;
		color: #ffffff;
		border: none;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		box-shadow: 0 4px 0 #16a34a;
		transition:
			background-color 0.15s,
			transform 0.1s,
			box-shadow 0.1s;
		margin-top: 0.5rem;
	}

	.submit-btn:hover:not(:disabled) {
		background-color: #4ade80;
		transform: scale(1.02);
	}

	.submit-btn:active:not(:disabled) {
		transform: scale(0.98) translateY(2px);
		box-shadow: 0 2px 0 #16a34a;
	}

	.submit-btn:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}

	.auth-footer {
		text-align: center;
		margin-top: 2rem;
		font-size: 0.9rem;
		color: #6b7280;
	}

	.auth-footer a {
		color: #2563eb;
		text-decoration: none;
		font-weight: 600;
		transition: color 0.15s ease-in-out;
	}

	.auth-footer a:hover {
		color: #1d4ed8;
		text-decoration: underline;
	}

	/* Spinner animation */
	.spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Screen reader only text */
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
