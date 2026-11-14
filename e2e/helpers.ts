import { expect, type Page, type TestInfo } from '@playwright/test';

export const PASSWORD = 'LocalTest!234';

export function trackPage(page: Page, testInfo: TestInfo) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`);
  });
  return {
    async attach() {
      await testInfo.attach('console-errors', {
        body: consoleErrors.join('\n') || 'none',
        contentType: 'text/plain',
      });
      await testInfo.attach('failed-requests', {
        body: failedRequests.join('\n') || 'none',
        contentType: 'text/plain',
      });
    },
    consoleErrors,
    failedRequests,
  };
}

export async function openSignIn(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
}

export async function signUp(page: Page, name: string, email: string) {
  await openSignIn(page);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  await page.getByPlaceholder('Enter your full name').fill(name);
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create Account' }).click();
}

export async function confirmEmail(email: string) {
  const deadline = Date.now() + 20_000;
  let link = '';
  while (Date.now() < deadline) {
    const list = await fetch('http://127.0.0.1:54324/api/v1/messages');
    if (!list.ok) throw new Error(`Mailpit unavailable: ${list.status}`);
    const data = await list.json() as { messages?: Array<{ ID: string; To: Array<{ Address: string }>; Subject: string }> };
    const message = (data.messages ?? []).find((item) =>
      item.To?.some((to) => to.Address.toLowerCase() === email.toLowerCase())
      && item.Subject.toLowerCase().includes('confirm')
    );
    if (message) {
      const full = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
      const body = await full.json() as { HTML?: string; Text?: string };
      const html = body.HTML || body.Text || '';
      const match = html.match(/href="([^"]+)"/);
      if (!match) throw new Error('Confirmation email has no link');
      link = match[1].replace(/&amp;/g, '&');
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!link) throw new Error(`No confirmation email for ${email}`);
  const response = await fetch(link, { redirect: 'manual' });
  if (response.status !== 303 && response.status !== 302 && response.status !== 200) {
    throw new Error(`Confirmation link returned ${response.status}`);
  }
}

export async function signIn(page: Page, email: string) {
  await openSignIn(page);
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('button', { name: 'Sign In' })).toHaveCount(0);
}

export async function signOut(page: Page) {
  await page.locator('header').getByRole('button').last().click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
  await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
}
