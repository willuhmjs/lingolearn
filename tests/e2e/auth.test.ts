import { test, expect } from '@playwright/test';

// Run serially — the app's auth rate limiter is 5 req/min per IP for /login and /signup.
test.describe.configure({ mode: 'serial' });

// ─── Auth redirect tests ──────────────────────────────────────────────────────
// Use the request fixture (no browser rendering) to avoid triggering the
// auth rate limiter (5 req/min) which fires on GET /login page loads.

test('unauthenticated access to protected routes redirects to /login', async ({ request }) => {
	for (const path of ['/dashboard', '/play', '/review', '/classes']) {
		const res = await request.get(path, { maxRedirects: 0 });
		expect(res.status()).toBe(303);
		const location = res.headers()['location'] ?? '';
		expect(location).toContain('/login');
	}
});

test('redirect preserves the original path in redirectTo query param', async ({ request }) => {
	const res = await request.get('/dashboard', { maxRedirects: 0 });
	const location = res.headers()['location'] ?? '';
	const url = new URL(location, 'http://localhost');
	expect(url.searchParams.get('redirectTo')).toBe('/dashboard');
});

// ─── Login page ───────────────────────────────────────────────────────────────
// All assertions run in a single page load to stay within the rate limit budget.

test('Login page renders correctly', async ({ page }) => {
	await page.goto('/login');

	await expect(page.getByRole('heading', { name: /log in/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();

	const signupLink = page.getByRole('link', { name: /sign up/i });
	await expect(signupLink).toBeVisible();
	await expect(signupLink).toHaveAttribute('href', '/signup');

	// If local login form is shown, inputs should be enabled
	const identifierInput = page.getByLabel(/username or email/i);
	if ((await identifierInput.count()) > 0) {
		await expect(identifierInput).toBeEnabled();
		await expect(page.getByLabel(/password/i)).toBeEnabled();
	}
});

// ─── Signup page ──────────────────────────────────────────────────────────────
// All assertions run in a single page load to stay within the rate limit budget.

test('Signup page renders correctly', async ({ page }) => {
	await page.goto('/signup');

	await expect(page.getByRole('heading', { name: /create a new account/i })).toBeVisible();
	await expect(page.getByRole('button', { name: /sign up with google/i })).toBeVisible();

	const loginLink = page.getByRole('link', { name: /login here/i });
	await expect(loginLink).toBeVisible();
	await expect(loginLink).toHaveAttribute('href', '/login');

	await expect(page.getByRole('link', { name: /terms of service/i }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: /privacy policy/i }).first()).toBeVisible();

	// Password strength indicator
	const passwordInput = page.getByLabel('Password');
	if ((await passwordInput.count()) > 0) {
		await passwordInput.fill('Test1234!');
		await expect(page.locator('.password-strength')).toBeVisible();
	}
});
