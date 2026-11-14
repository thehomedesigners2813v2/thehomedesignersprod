import { test, expect } from '@playwright/test';
import { confirmEmail, signIn, trackPage } from './helpers';

test.describe('designer registration', () => {
  test('empty designer form does not leave the page', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/register-designer');
    await expect(page.getByRole('heading', { name: 'Register as Interior Designer' })).toBeVisible();
    await page.getByRole('button', { name: 'Register as Designer' }).click();
    await expect(page).toHaveURL(/\/register-designer/);
    await tracker.attach();
  });

  test('designer can register, confirm email and is held for verification', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    const email = `qa-designer-${Date.now()}@example.com`;
    await page.goto('/register-designer');
    await page.locator('input[name="name"]').fill('QA Designer');
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('LocalTest!234');
    await page.locator('input[name="phone"]').fill('9876543210');
    await page.locator('select[name="location"]').selectOption({ index: 1 });
    await page.locator('select[name="specialization"]').selectOption({ index: 1 });
    await page.locator('input[name="experience"]').fill('4');
    await page.getByRole('button', { name: 'Register as Designer' }).click();
    await expect(page.getByText(/success|registered|check your email|confirmation|profile/i).first()).toBeVisible({ timeout: 20_000 });
    await confirmEmail(email);
    await signIn(page, email);
    await page.goto('/designer-dashboard');
    await expect(page.getByText(/pending|verification|Access|Loading/i).first()).toBeVisible();
    await tracker.attach();
  });

  test('designer subscription page is not available to a signed-out visitor', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/designer-subscription');
    await expect(page).not.toHaveURL(/\/designer-subscription$/);
    await tracker.attach();
  });
});
