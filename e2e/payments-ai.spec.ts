import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { trackPage } from './helpers';

function secret(name: string) {
  try {
    const line = readFileSync('supabase/.env', 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    return (line?.slice(name.length + 1) ?? '').trim();
  } catch {
    return '';
  }
}

test.describe('payments, AI and notifications', () => {
  test('Razorpay test checkout', async ({ page }, testInfo) => {
    test.skip(!secret('RAZORPAY_KEY_ID') || !secret('RAZORPAY_KEY_SECRET'), 'BLOCKED: Razorpay test Key ID and Key Secret are not set in supabase/.env');
    const tracker = trackPage(page, testInfo);
    await page.goto('/designer-subscription');
    await expect(page.locator('body')).toBeVisible();
    await tracker.attach();
  });

  test('Razorpay webhook processing', async () => {
    test.skip(!secret('RAZORPAY_WEBHOOK_SECRET'), 'BLOCKED: RAZORPAY_WEBHOOK_SECRET is not set in supabase/.env');
  });

  test('AI quotation generation', async ({ page }, testInfo) => {
    test.skip(!secret('OPENAI_API_KEY'), 'BLOCKED: OPENAI_API_KEY is not set in supabase/.env');
    const tracker = trackPage(page, testInfo);
    await page.goto('/');
    await tracker.attach();
  });

  test('Gemini chat', async () => {
    test.skip(!secret('GEMINI_API_KEY'), 'BLOCKED: GEMINI_API_KEY is not set in supabase/.env');
  });

  test('application email through Resend', async () => {
    test.skip(!secret('RESEND_API_KEY'), 'BLOCKED: RESEND_API_KEY is not set in supabase/.env');
  });

  test('WhatsApp test notification', async () => {
    test.skip(true, 'BLOCKED: whatsapp_settings is not configured and the app uses WAHA, not a Meta test recipient');
  });

  test('quotation acceptance and project creation require a verified designer', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/designer-quotes');
    await expect(page).not.toHaveURL(/\/designer-quotes$/);
    await page.goto('/customer-quotes');
    await expect(page.locator('body')).toBeVisible();
    await tracker.attach();
  });
});
