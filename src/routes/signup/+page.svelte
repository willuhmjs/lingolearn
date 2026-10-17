<script lang="ts">
  import { enhance } from '$app/forms';
  import { signIn } from '@auth/sveltekit/client';
  import { fly } from 'svelte/transition';
  import { toastError } from '$lib/utils/toast';
  let {
    data,
    form = null
  }: { data: { localLoginEnabled: boolean }; form: { error?: string } | null } = $props();

  let isGoogleSigningIn = $state(false);
  let isSubmitting = $state(false);
  let password = $state('');
  let username = $state('');
  let passwordStrength = $derived(calculatePasswordStrength(password));

  let usernameSuggestion = $derived((form as any)?.usernameSuggestion ?? null);

  // Show error as toast (but not when we have a suggestion — that's shown inline)
  $effect(() => {
    if (form?.error && !usernameSuggestion) {
      toastError(form.error);
    }
  });

  async function handleGoogleSignIn() {
    if (isGoogleSigningIn) return;
    isGoogleSigningIn = true;
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (_) {
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
      <h2>Create a new account</h2>
      <p>Join us today to get started.</p>
    </div>

    <div class="google-auth">
      <button
        class="google-btn"
        onclick={handleGoogleSignIn}
        disabled={isGoogleSigningIn}
        aria-label="Sign up with Google"
        aria-busy={isGoogleSigningIn}
      >
        {#if isGoogleSigningIn}
          <span class="spinner" aria-hidden="true"></span>
        {:else}
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
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
      <p class="legal-notice-google">
        By signing up, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer"
          >Terms of Service</a
        >
        and
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
      </p>
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
        aria-label="Signup form"
      >
        <div class="form-group">
          <label for="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            required
            disabled={isSubmitting}
            bind:value={username}
            placeholder="Enter your username"
            aria-label="Username"
          />
          {#if form?.error && usernameSuggestion}
            <p class="field-error">{form.error}</p>
            <p class="username-suggestion">
              How about <strong>{usernameSuggestion}</strong>?
              <button
                type="button"
                class="use-suggestion-btn"
                onclick={() => {
                  username = usernameSuggestion;
                }}>Use this</button
              >
            </p>
          {/if}
        </div>

        <div class="form-group">
          <label for="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autocomplete="email"
            required
            disabled={isSubmitting}
            placeholder="Enter your email"
            aria-label="Email address"
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
            bind:value={password}
            placeholder="Create a password (min. 8 characters)"
            aria-label="Password"
            aria-describedby={password ? 'password-strength' : undefined}
            minlength="8"
          />
          {#if password}
            <div id="password-strength" class="password-strength" role="status" aria-live="polite">
              <div class="strength-bar">
                <div
                  class="strength-fill"
                  style="width: {(passwordStrength.score / 5) *
                    100}%; background-color: {passwordStrength.color}"
                ></div>
              </div>
              <span class="strength-label" style="color: {passwordStrength.color}">
                {passwordStrength.label}
              </span>
            </div>
          {/if}
        </div>

        <p class="legal-notice">
          By signing up, you agree to our <a href="/terms" target="_blank" rel="noopener noreferrer"
            >Terms of Service</a
          >
          and
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
    background-color: var(--card-bg);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
    padding: 2.5rem 2rem;
    box-sizing: border-box;
    border: 1px solid var(--card-border);
  }

  .auth-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .auth-header h2 {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-color);
  }

  .auth-header p {
    margin: 0;
    color: var(--text-muted);
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
    background-color: var(--card-bg);
    color: var(--text-color);
    border: 1px solid var(--card-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease-in-out;
  }

  .google-btn:hover:not(:disabled) {
    background-color: var(--link-hover-bg);
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
    border-bottom: 1px solid var(--card-border);
  }

  .divider span {
    padding: 0 0.625rem;
    color: var(--text-muted);
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
    color: var(--text-color);
  }

  .form-group input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--input-border);
    border-radius: var(--radius-md);
    font-size: 1rem;
    font-family: inherit;
    color: var(--input-text);
    background-color: var(--input-bg);
    box-sizing: border-box;
    transition:
      border-color 0.15s ease-in-out,
      box-shadow 0.15s ease-in-out;
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--color-success);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.14);
  }

  .form-group input::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: var(--card-border);
  }

  .legal-notice-google {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.5;
    margin-top: 0.75rem;
  }

  .legal-notice-google a,
  .legal-notice a {
    color: var(--brand-color);
    text-decoration: none;
    font-weight: 500;
  }

  .legal-notice-google a:hover,
  .legal-notice a:hover {
    text-decoration: underline;
  }

  .legal-notice {
    font-size: 0.8rem;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.5;
    margin-top: 0.25rem;
  }

  .submit-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--color-success);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-lg);
    font-size: 1rem;
    font-weight: 800;
    font-family: inherit;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    box-shadow: 0 4px 0 var(--color-success-hover);
    transition:
      background-color 0.15s,
      transform 0.1s,
      box-shadow 0.1s;
    margin-top: 0.5rem;
  }

  .submit-btn:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow: 0 0 0 var(--color-success-hover);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .submit-btn:focus-visible {
    outline: 3px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .auth-footer {
    text-align: center;
    margin-top: 2rem;
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .auth-footer a {
    color: var(--brand-color);
    text-decoration: none;
    font-weight: 600;
    transition: color 0.15s ease-in-out;
  }

  .auth-footer a:hover {
    text-decoration: underline;
  }

  .field-error {
    margin: 0.25rem 0 0;
    font-size: 0.8rem;
    color: var(--color-danger);
    font-weight: 500;
  }

  .username-suggestion {
    margin: 0.375rem 0 0;
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .use-suggestion-btn {
    background: none;
    border: none;
    color: var(--color-success);
    font-weight: 700;
    cursor: pointer;
    font-size: 0.8rem;
    padding: 0;
    margin-left: 0.2rem;
    text-decoration: underline;
  }

  .use-suggestion-btn:hover {
    color: var(--color-success-hover);
  }

  /* Password strength indicator */
  .password-strength {
    margin-top: 0.5rem;
  }

  .strength-bar {
    width: 100%;
    height: 4px;
    background-color: var(--card-border);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 0.25rem;
  }

  .strength-fill {
    height: 100%;
    transition:
      width 0.3s ease,
      background-color 0.3s ease;
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
