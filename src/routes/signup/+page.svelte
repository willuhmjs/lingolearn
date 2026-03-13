<script lang="ts">
	import { enhance } from '$app/forms';
	import { signIn } from '@auth/sveltekit/client';
	import { fly } from 'svelte/transition';
	import { toastError } from '$lib/utils/toast';
	let { data, form = null }: { data: { localLoginEnabled: boolean }; form: { error?: string } | null } = $props();

	let isGoogleSigningIn = $state(false);
	let isSubmitting = $state(false);
	let password = $state('');
	let passwordStrength = $derived(calculatePasswordStrength(password));

	// Show error as toast notification
	$effect(() => {
		if (form?.error) {
			toastError(form.error);
		}
	});

	async function handleGoogleSignIn() {
		if (isGoogleSigningIn) return;
		isGoogleSigningIn = true;
		try {
			await signIn('google', { callbackUrl: '/dashboard' });
		} catch (error) {
			toastError('Failed to sign in with Google');
			isGoogleSigningIn = false;
		}
	}

	function calculatePasswordStrength(pwd: string): { score: number; label: string; color: string } {
		if (!pwd) return { score: 0, label: '', color: '' };
		let score = 0;
		if (pwd.length >= 8) score++;
		if (pwd.length >= 12) score++;
		if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
		if (/\d/.test(pwd)) score++;
		if (/[^a-zA-Z\d]/.test(pwd)) score++;

		if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
		if (score === 3) return { score, label: 'Fair', color: '#f59e0b' };
		if (score === 4) return { score, label: 'Good', color: '#10b981' };
		return { score, label: 'Strong', color: '#22c55e' };
	}
</script>

<div class="page-container">
	<div class="auth-card" in:fly={{ y: 20, duration: 400 }}>
		<div class="auth-header">
			<h2 class="dark:text-white">Create a new account</h2>
			<p class="dark:text-slate-400">Join us today to get started.</p>
		</div>

		<div class="google-auth">
			<button
				class="google-btn dark:bg-slate-800 dark:text-white dark:border-slate-700"
				onclick={handleGoogleSignIn}
				disabled={isGoogleSigningIn}
				aria-label="Sign up with Google"
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
				{isGoogleSigningIn ? 'Signing up...' : 'Sign up with Google'}
			</button>
			<p class="legal-notice-google dark:text-slate-400">
				By signing up, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and
				<a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
			</p>
		</div>

		{#if data.localLoginEnabled}
			<div class="divider">
				<span class="dark:text-slate-400">or continue with email</span>
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
				aria-label="Signup form"
			>
				<div class="form-group">
					<label for="username" class="dark:text-slate-300">Username</label>
					<input
						id="username"
						name="username"
						type="text"
						required
						disabled={isSubmitting}
						placeholder="Enter your username"
						aria-label="Username"
						class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
					/>
				</div>

				<div class="form-group">
					<label for="email" class="dark:text-slate-300">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						disabled={isSubmitting}
						placeholder="Enter your email"
						aria-label="Email address"
						class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
					/>
				</div>

				<div class="form-group">
					<label for="password" class="dark:text-slate-300">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						disabled={isSubmitting}
						bind:value={password}
						placeholder="Create a password (min. 8 characters)"
						aria-label="Password"
						aria-describedby={password ? 'password-strength' : undefined}
						minlength="8"
						class="dark:bg-slate-900 dark:text-white dark:border-slate-700"
					/>
					{#if password}
						<div id="password-strength" class="password-strength" role="status" aria-live="polite">
							<div class="strength-bar">
								<div
									class="strength-fill"
									style="width: {(passwordStrength.score / 5) * 100}%; background-color: {passwordStrength.color}"
								></div>
							</div>
							<span class="strength-label" style="color: {passwordStrength.color}">
								{passwordStrength.label}
							</span>
						</div>
					{/if}
				</div>

				<p class="legal-notice dark:text-slate-400">
					By signing up, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and
					<a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
				</p>

				<button type="submit" class="submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
					{#if isSubmitting}
						<span class="spinner" aria-hidden="true"></span>
					{/if}
					{isSubmitting ? 'Signing up...' : 'Sign up'}
				</button>
			</form>

			<div class="auth-footer">
				<p>Already have an account? <a href="/login">Login here</a></p>
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
		background-color: #f9fafb;
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
		border-bottom: 1px solid #d1d5db;
	}

	.divider span {
		padding: 0 10px;
		color: #6b7280;
		font-size: 0.875rem;
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

	.legal-notice-google {
		font-size: 0.8rem;
		color: #6b7280;
		text-align: center;
		line-height: 1.5;
		margin-top: 0.75rem;
	}

	.legal-notice-google a {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.legal-notice-google a:hover {
		color: #1d4ed8;
		text-decoration: underline;
	}

	.legal-notice {
		font-size: 0.8rem;
		color: #6b7280;
		text-align: center;
		line-height: 1.5;
		margin-top: 0.25rem;
	}

	.legal-notice a {
		color: #2563eb;
		text-decoration: none;
		font-weight: 500;
	}

	.legal-notice a:hover {
		color: #1d4ed8;
		text-decoration: underline;
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

	.submit-btn:focus-visible {
		outline: 2px solid #22c55e;
		outline-offset: 2px;
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

	/* Password strength indicator */
	.password-strength {
		margin-top: 0.5rem;
	}

	.strength-bar {
		width: 100%;
		height: 4px;
		background-color: #e5e7eb;
		border-radius: 2px;
		overflow: hidden;
		margin-bottom: 0.25rem;
	}

	.strength-fill {
		height: 100%;
		transition: width 0.3s ease, background-color 0.3s ease;
	}

	.strength-label {
		font-size: 0.75rem;
		font-weight: 600;
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
