import { test, expect } from '@playwright/test';
import { confirmEmail, PASSWORD, signIn, signOut, signUp, trackPage } from './helpers';

test.describe('homeowner authentication', () => {
  test('signup rejects a weak password', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByPlaceholder('Enter your full name').fill('QA Homeowner');
    await page.getByPlaceholder('Enter your email').fill(`weak-${Date.now()}@example.com`);
    await page.getByPlaceholder('Enter your password').fill('abc');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText(/Password must/i)).toBeVisible();
    await tracker.attach();
  });

  test('homeowner can register, confirm email, sign in and sign out', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    const email = `qa-homeowner-${Date.now()}@example.com`;
    await signUp(page, 'QA Homeowner', email);
    await expect(page.getByText(/Account created successfully|confirm your email|verification email|check your email/i)).toBeVisible();
    await confirmEmail(email);
    await signIn(page, email);
    await signOut(page);
    await tracker.attach();
  });

  test('unconfirmed homeowner cannot sign in', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    const email = `qa-unconfirmed-${Date.now()}@example.com`;
    await signUp(page, 'QA Unconfirmed', email);
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.getByPlaceholder('Enter your password').fill(PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText(/confirm|verify|not confirmed|invalid/i)).toBeVisible();
    await tracker.attach();
  });

  test('signed-out visitor cannot open project registration', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/register-customer');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
    await tracker.attach();
  });

  test('login offers a password reset', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).first().click();
    await expect(page.getByRole('button', { name: /forgot|reset password/i })).toBeVisible();
    await tracker.attach();
  });
});
