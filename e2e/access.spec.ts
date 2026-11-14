import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, expect } from '@playwright/test';
import { confirmEmail, signIn, signUp, trackPage } from './helpers';

const execFileAsync = promisify(execFile);

test.describe('access control', () => {
  test('signed-out visitor is sent away from the admin dashboard', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin-login/);
    await tracker.attach();
  });

  test('a homeowner is denied the admin dashboard', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    const email = `qa-access-${Date.now()}@example.com`;
    await signUp(page, 'QA Access', email);
    await confirmEmail(email);
    await signIn(page, email);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await tracker.attach();
  });

  test('a homeowner cannot open the designer dashboard', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    const email = `qa-not-designer-${Date.now()}@example.com`;
    await signUp(page, 'QA Customer', email);
    await confirmEmail(email);
    await signIn(page, email);
    await page.goto('/designer-dashboard');
    await expect(page).toHaveURL(/\/$/);
    await tracker.attach();
  });

  test('an active local admin can open the admin overview', async ({ page }, testInfo) => {
    const tracker = trackPage(page, testInfo);
    const email = `qa-admin-${Date.now()}@example.com`;
    await signUp(page, 'QA Admin', email);
    await confirmEmail(email);
    const docker = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
    const sql = `insert into public.admin_users (user_id, email, role, is_active) select id, email, 'admin', true from auth.users where email = '${email}' on conflict (user_id) do update set is_active = true;`;
    try {
      await execFileAsync(docker, ['exec', 'supabase_db_thehomedesignersdev', 'psql', '-U', 'postgres', '-d', 'postgres', '-c', sql]);
    } catch (error) {
      test.skip(true, `BLOCKED: local database was not reachable to create an admin (${error instanceof Error ? error.message : 'unknown'})`);
    }
    await page.goto('/admin-login');
    await page.getByLabel('Email Address').fill(email);
    await page.getByLabel('Password').fill('LocalTest!234');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await tracker.attach();
  });
});
