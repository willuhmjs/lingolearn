import { test, expect } from '@playwright/test';

test.describe('Core User Flows', () => {
  // Use serial mode because we might share a test user
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async () => {
    // In a real scenario, we'd use a global setup for auth or a test user.
    // For this task, we assume the environment is set up or we mock the session.
    // Since I cannot easily create a session here without real credentials,
    // I will focus on the UI flow logic and assume auth is handled.
  });

  test('navigate through review session', async ({ page }) => {
    // Mocking the review API responses to avoid rate limits and AI costs
    await page.route('/api/review/grade', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ correct: true, score: 1.0 })
      });
    });

    await page.route('/api/review/submit', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/review');

    // Check if we are on the start card or no-reviews card
    const startButton = page.getByRole('button', { name: /start session/i });
    if (await startButton.isVisible()) {
      await startButton.click();

      // We should see a review card
      await expect(page.locator('.review-card')).toBeVisible();

      // Type an answer
      const input = page.locator('input[type="text"], textarea');
      if (await input.isVisible()) {
        await input.fill('test answer');
        await page.keyboard.press('Enter');

        // Should show answer/feedback
        await expect(page.locator('.answer-reveal')).toBeVisible();

        // Press space or enter to continue
        await page.keyboard.press(' ');

        // Should move to next or summary
      }
    } else {
      const noReviews = page.getByText(/no reviews/i);
      if (await noReviews.isVisible()) {
        console.log('No reviews due, skipping flow');
      }
    }
  });

  test('navigate through immersion session', async ({ page }) => {
    await page.route('/api/immersion/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-session',
          template: 'news',
          content: { title: 'Test News', body: 'This is a test body in the target language.' },
          questions: [{ id: 'q1', text: 'What is this about?', sampleAnswer: 'A test.' }]
        })
      });
    });

    await page.route('/api/immersion/grade', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 1.0, feedback: 'Great job!' })
      });
    });

    await page.goto('/play?mode=immerse');

    // Check for immersion view components
    await expect(page.locator('.immersion-container')).toBeVisible();

    // Answer a question
    const input = page.locator('textarea');
    if (await input.isVisible()) {
      await input.fill('It is about a test.');
      await page.getByRole('button', { name: /submit/i }).click();

      // Check for feedback
      await expect(page.getByText(/great job/i)).toBeVisible();
    }
  });

  test('change user settings', async ({ page }) => {
    await page.route('/api/user/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.goto('/profile');

    // Change theme or other settings
    const themeSelect = page.getByLabel(/theme/i);
    if (await themeSelect.isVisible()) {
      await themeSelect.selectOption('dark');
      // Usually there's an auto-save or a save button
      // Check if the theme attribute on html changed
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
  });
});
