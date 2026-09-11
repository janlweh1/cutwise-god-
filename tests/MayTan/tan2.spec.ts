import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// ROLE-BASED ACCESS CONTROL TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Role-Based Access Control', () => {

  // ── Inventory Clerk Role ──────────────────────────────────
  test.describe('Inventory Clerk Role', () => {

    test('clerk should land on the inventory_clerk dashboard after login', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
    });

    test('clerk should see Inventory (Raw), Scrap, and Suppliers in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      await expect(page.getByRole('button', { name: 'Inventory (Raw)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Scrap' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Suppliers' })).toBeVisible();
    });

    test('clerk should NOT see Analytics & AI in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      // Analytics & AI is restricted to supervisor and admin only
      await expect(page.getByRole('button', { name: 'Analytics & AI' })).not.toBeVisible();
    });

    test('clerk should NOT see Configuration in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      // Configuration is admin-only
      await expect(page.getByRole('button', { name: 'Configuration' })).not.toBeVisible();
    });

  });

  // ── Supervisor Role ───────────────────────────────────────
  test.describe('Supervisor Role', () => {

    test('supervisor should land on the supervisor dashboard after login', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('supervisor@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page).toHaveURL(/dashboard\/supervisor/);
    });

    test('supervisor should see Analytics & AI in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('supervisor@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/supervisor/);

      await expect(page.getByRole('button', { name: 'Analytics & AI' })).toBeVisible();
    });

    test('supervisor should NOT see Configuration in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('supervisor@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/supervisor/);

      // Configuration is admin-only
      await expect(page.getByRole('button', { name: 'Configuration' })).not.toBeVisible();
    });

  });

  // ── Admin Role ────────────────────────────────────────────
  test.describe('Admin Role', () => {

    test('admin should land on the admin dashboard after login', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('admin@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();

      await expect(page).toHaveURL(/dashboard\/admin/);
    });

    test('admin should see Analytics & AI and Configuration in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('admin@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/admin/);

      await expect(page.getByRole('button', { name: 'Analytics & AI' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Configuration' })).toBeVisible();
    });

  });

  // ── Unauthenticated Access ────────────────────────────────
  test.describe('Unauthenticated Access', () => {

    test('unauthenticated user should be redirected to login when accessing admin dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/admin`);
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('unauthenticated user should be redirected to login when accessing supervisor dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/supervisor`);
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('unauthenticated user should be redirected to login when accessing clerk dashboard', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/inventory_clerk`);
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

  });

});
