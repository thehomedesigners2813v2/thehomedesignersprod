import { test, expect } from '@playwright/test';
import { trackPage } from './helpers';

test.describe('public website', () => {
  test('homepage loads the marketplace', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find the Right Interior Designer/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'TheHomeDesigners' }).first()).toBeVisible();
    await tracker.attach();
  });

  test('primary navigation reaches designers, deals and projects', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/');
    await page.getByRole('link', { name: 'Find Designers' }).first().click();
    await expect(page).toHaveURL(/\/designers/);
    await page.goto('/deals');
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first()).toBeVisible();
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/projects/);
    await tracker.attach();
  });

  test('designer search accepts a query', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/');
    await page.getByPlaceholder('Designer name, style or location').fill('Chennai');
    await page.getByRole('button', { name: 'Search Designers' }).click();
    await expect(page).toHaveURL(/\/designers/);
    await tracker.attach();
  });

  test('deals page renders an empty or populated state', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/deals');
    await expect(page.locator('body')).toContainText(/deal|offer|coming soon|no /i);
    await tracker.attach();
  });

  test('homepage remains usable on a phone viewport', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Find the Right Interior Designer/i })).toBeVisible();
    await tracker.attach();
  });
});
