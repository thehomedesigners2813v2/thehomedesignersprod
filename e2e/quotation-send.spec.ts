import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, expect } from '@playwright/test';
import { confirmEmail, signIn, signUp, trackPage } from './helpers';

const execFileAsync = promisify(execFile);
const docker = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';

async function sql(statement: string) {
  const { stdout } = await execFileAsync(docker, [
    'exec', 'supabase_db_thehomedesignersdev', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-c', statement,
  ]);
  const id = stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return id ? id[0] : stdout.trim();
}

test('designer can send a quotation and the customer can see it', async ({ page }, testInfo) => {
  const tracker = trackPage(page, testInfo);
  const stamp = Date.now();
  const designerEmail = `qa-quote-designer-${stamp}@example.com`;
  const customerEmail = `qa-quote-customer-${stamp}@example.com`;
  const projectName = `QA Home ${stamp}`;
  const quoteTitle = `QA Living Room Quote ${stamp}`;

  await page.goto('/register-designer');
  await page.locator('input[name="name"]').fill('QA Quote Designer');
  await page.locator('input[name="email"]').fill(designerEmail);
  await page.locator('input[name="password"]').fill('LocalTest!234');
  await page.locator('input[name="phone"]').fill('9876543210');
  await page.locator('select[name="location"]').selectOption({ index: 1 });
  await page.locator('select[name="specialization"]').selectOption({ index: 1 });
  await page.locator('input[name="experience"]').fill('4');
  await page.getByRole('button', { name: 'Register as Designer' }).click();
  await expect(page.getByText(/success|registered|check your email|confirmation|profile/i).first()).toBeVisible({ timeout: 20_000 });
  await confirmEmail(designerEmail);

  await page.evaluate(() => localStorage.clear());
  await signUp(page, 'QA Quote Customer', customerEmail);
  await confirmEmail(customerEmail);

  const designerId = await sql(`select id from public.designers where email = '${designerEmail}'`);
  const customerUserId = await sql(`select id from auth.users where email = '${customerEmail}'`);
  if (!designerId || !customerUserId) {
    test.skip(true, 'BLOCKED: local designer or customer account was not created');
    return;
  }
  await sql(`update public.designers set verification_status = 'verified', is_verified = true, is_active = true where id = '${designerId}'`);
  const projectId = await sql(`insert into public.customers (user_id, assigned_designer_id, name, email, phone, project_name, property_type, location) values ('${customerUserId}', '${designerId}', 'QA Quote Customer', '${customerEmail}', '9876543210', '${projectName}', 'Apartment', 'Chennai') returning id`);

  await page.evaluate(() => localStorage.clear());
  await signIn(page, designerEmail);
  await page.goto(`/generate-quote/${projectId}`);
  await expect(page.getByRole('heading', { name: 'Create Quote' })).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder('e.g. Complete 3BHK Interior Design').fill(quoteTitle);
  await page.getByRole('button', { name: 'Add Item' }).first().click();
  await page.getByPlaceholder('e.g. TV Unit').fill('TV Unit');
  await page.getByLabel('Pricing mode').selectOption('standard');
  await page.getByLabel('Unit price').fill('1000');
  await page.getByRole('button', { name: 'Save Item' }).click();
  await expect(page.getByText('TV Unit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Send to Customer' }).click();
  await expect(page.getByText('Quote sent successfully.')).toBeVisible();
  await page.goto('/designer-quotes');
  await expect(page.getByText(projectName).first()).toBeVisible();
  await expect(page.getByText('Could not embed because more than one relationship was found')).toHaveCount(0);

  const saved = await sql(`select status || '|' || subtotal::text || '|' || tax_amount::text || '|' || total_amount::text from public.designer_quotes where title = '${quoteTitle}'`);
  expect(saved).toMatch(/^sent\|1000(\.0+)?\|/);
  expect(saved).toContain('1180');

  await page.evaluate(() => localStorage.clear());
  await signIn(page, customerEmail);
  await page.goto('/customer-quotes');
  await expect(page.getByText(quoteTitle).first()).toBeVisible();
  await tracker.attach();
});
