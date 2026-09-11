import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in as Admin and navigate to Configuration
// ─────────────────────────────────────────────────────────────
async function goToConfiguration(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('admin@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/admin/);
  await page.getByRole('button', { name: 'Configuration' }).click();
  await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// CONFIGURATION PANEL TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Configuration Panel (Admin)', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the Configuration heading when admin navigates to Configuration', async ({ page }) => {
      await goToConfiguration(page);
      await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();
    });

    test('should show the User Management tab button', async ({ page }) => {
      await goToConfiguration(page);
      await expect(page.locator('#config-tab-users')).toBeVisible();
    });

    test('should show the System Info tab button', async ({ page }) => {
      await goToConfiguration(page);
      await expect(page.locator('#config-tab-system')).toBeVisible();
    });

    test('User Management tab — should display the Add User button', async ({ page }) => {
      await goToConfiguration(page);

      // User Management is the default tab
      await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
    });

    test('User Management tab — should open the Add User modal when button is clicked', async ({ page }) => {
      await goToConfiguration(page);

      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.modal-header h3')).toContainText('Add User');
    });

    test('User Management tab — should display full name, email, and role fields in Add User modal', async ({ page }) => {
      await goToConfiguration(page);

      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // All required fields should be present
      await expect(page.locator('input[name="full_name"]')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('select[name="role"]')).toBeVisible();
    });

    test('User Management tab — should close the Add User modal when Cancel is clicked', async ({ page }) => {
      await goToConfiguration(page);

      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.modal-overlay')).not.toBeVisible();
    });

    test('User Management tab — should display the user list table with correct headers', async ({ page }) => {
      await goToConfiguration(page);

      // The user table should show Name, Email, Role columns
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
    });

    test('System Info tab — should display system information entries', async ({ page }) => {
      await goToConfiguration(page);

      // Switch to System Info tab
      await page.locator('#config-tab-system').click();

      // At least one known system info label should be visible
      await expect(page.getByText('API Version')).toBeVisible();
      await expect(page.getByText('Authentication')).toBeVisible();
      await expect(page.getByText('Database')).toBeVisible();
    });

    test('System Info tab — should show correct values for known system properties', async ({ page }) => {
      await goToConfiguration(page);

      await page.locator('#config-tab-system').click();

      await expect(page.getByText('v1')).toBeVisible();
      await expect(page.getByText('JWT (Bearer Token)')).toBeVisible();
      await expect(page.getByText('PostgreSQL')).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('should show validation error when Add User form is submitted empty', async ({ page }) => {
      await goToConfiguration(page);

      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Submit without filling anything
      await page.locator('form').getByRole('button', { name: 'Add User' }).click();

      // Modal stays open and at least one error appears
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error').first()).toBeVisible();
    });

    test('should show validation error when email is missing in Add User form', async ({ page }) => {
      await goToConfiguration(page);

      await page.getByRole('button', { name: 'Add User' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Fill name and role but leave email blank
      await page.locator('input[name="full_name"]').fill('Test User');
      await page.locator('select[name="role"]').selectOption('inventory_clerk');
      // Skip email intentionally
      await page.locator('form').getByRole('button', { name: 'Add User' }).click();

      // Modal should remain open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error')).toBeVisible();
    });

    test('clerk role should NOT see the Configuration button in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      // Configuration is strictly admin-only
      await expect(page.getByRole('button', { name: 'Configuration' })).not.toBeVisible();
    });

  });

});
