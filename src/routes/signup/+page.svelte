<script lang="ts">
	import { enhance } from '$app/forms';
	import { signIn } from '@auth/sveltekit/client';
	export let data: { localLoginEnabled: boolean };
	export let form: { error?: string } | null = null;
</script>

<div class="page-container">
	<div class="auth-card">
		<div class="auth-header">
			<h2>Create a new account</h2>
			<p>Join us today to get started.</p>
		</div>

		{#if form?.error}
			<div class="error-message">
				<strong>Error:</strong> {form.error}
			</div>
		{/if}

		<div class="google-auth">
			<button class="google-btn" on:click={() => signIn('google', { callbackUrl: '/dashboard' })}>
				<svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
				</svg>
				Sign in with Google
			</button>
		</div>

		{#if data.localLoginEnabled}
			<div class="divider">
				<span>or continue with email</span>
			</div>

			<form method="POST" use:enhance class="auth-form">
				<div class="form-group">
					<label for="username">Username</label>
					<input
						id="username"
						name="username"
						type="text"
						required
						placeholder="Enter your username"
					/>
				</div>

				<div class="form-group">
					<label for="email">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						placeholder="Enter your email"
					/>
				</div>

				<div class="form-group">
					<label for="password">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						placeholder="Create a password"
					/>
				</div>

				<button type="submit" class="submit-btn">
					Sign up
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
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
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

	.error-message {
		background-color: #fef2f2;
		border-left: 4px solid #ef4444;
		color: #b91c1c;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.error-message strong {
		font-weight: 600;
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

	.google-btn:hover {
		background-color: #f9fafb;
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
		transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
	}

	.form-group input:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
	}

	.form-group input::placeholder {
		color: #9ca3af;
	}

	.submit-btn {
		width: 100%;
		padding: 0.75rem 1rem;
		background-color: #4f46e5;
		color: #ffffff;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.15s ease-in-out;
		margin-top: 0.5rem;
	}

	.submit-btn:hover {
		background-color: #4338ca;
	}

	.submit-btn:focus-visible {
		outline: 2px solid #4f46e5;
		outline-offset: 2px;
	}

	.auth-footer {
		text-align: center;
		margin-top: 2rem;
		font-size: 0.9rem;
		color: #6b7280;
	}

	.auth-footer a {
		color: #4f46e5;
		text-decoration: none;
		font-weight: 500;
		transition: color 0.15s ease-in-out;
	}

	.auth-footer a:hover {
		color: #4338ca;
		text-decoration: underline;
	}
</style>
