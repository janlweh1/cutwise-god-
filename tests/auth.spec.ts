import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in as Inventory Clerk
// ─────────────────────────────────────────────────────────────
async function loginAsClerk(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
}

// ─────────────────────────────────────────────────────────────
// AUTH TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Authentication', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should allow Inventory Clerk to log in with valid credentials', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Should redirect to the inventory clerk dashboard
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
      // Dashboard nav items should be visible
      await expect(page.getByRole('button', { name: 'Inventory (Raw)' })).toBeVisible();
    });

    test('should display dashboard navigation after login', async ({ page }) => {
      await loginAsClerk(page);

      // Verify all main sidebar navigation buttons are present
      await expect(page.getByRole('button', { name: 'Inventory (Raw)' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Scrap' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Suppliers' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
    });

    test('should log out and return to login page', async ({ page }) => {
      await loginAsClerk(page);

      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Should be back at login page (root URL)
      await expect(page).toHaveURL(BASE_URL + '/');
      // Sign In button should be visible again
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('should show error when password is incorrect', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('wrongpassword123');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Error alert should appear
      await expect(page.getByRole('alert')).toBeVisible();
      // Should remain on the login page (not navigate to dashboard)
      await expect(page).not.toHaveURL(/dashboard/);
    });

    test('should show error when both fields are empty', async ({ page }) => {
      await page.goto(BASE_URL);

      // Click Sign In without filling anything
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Should show "Please fill in all fields" error
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByRole('alert')).toContainText('Please fill in all fields');
    });

  });

});
