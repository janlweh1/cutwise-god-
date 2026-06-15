import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in and navigate to the Audit Trail (Reports) view
// ─────────────────────────────────────────────────────────────
async function goToAuditLog(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'Select Inventory Clerk role' }).click();
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOG TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Audit Trail (Reports)', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the Audit Trail heading and log table', async ({ page }) => {
      await goToAuditLog(page);

      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
      // Table should be visible (assuming there are existing log records)
      await expect(page.locator('.data-table')).toBeVisible();
    });

    test('should display audit log columns correctly', async ({ page }) => {
      await goToAuditLog(page);

      // All expected column headers should be present
      await expect(page.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Details' })).toBeVisible();
    });

    test('should filter audit logs by action type', async ({ page }) => {
      await goToAuditLog(page);

      // Select "Material Added" from the action filter dropdown
      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('material_added');

      // Page should remain stable after filtering
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should filter audit logs using the search box', async ({ page }) => {
      await goToAuditLog(page);

      // Type in the search field
      await page.getByPlaceholder('Search details...').fill('Material');

      // Page should remain stable
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should show Clear Filters button when a filter is active', async ({ page }) => {
      await goToAuditLog(page);

      // Apply a search filter
      await page.getByPlaceholder('Search details...').fill('test');

      // The Clear Filters button should appear
      await expect(page.getByRole('button', { name: 'Clear Filters' })).toBeVisible();
    });

    test('should clear all filters when Clear Filters is clicked', async ({ page }) => {
      await goToAuditLog(page);

      // Apply filters
      await page.getByPlaceholder('Search details...').fill('something');
      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('material_added');

      // Clear Filters button should appear
      await expect(page.getByRole('button', { name: 'Clear Filters' })).toBeVisible();

      // Click it
      await page.getByRole('button', { name: 'Clear Filters' }).click();

      // The button should disappear (filters cleared)
      await expect(page.getByRole('button', { name: 'Clear Filters' })).not.toBeVisible();

      // Search box should be empty again
      await expect(page.getByPlaceholder('Search details...')).toHaveValue('');
    });

    test('should generate a new audit log entry after adding a material', async ({ page }) => {
      // Log in and add a material first to generate an audit log
      await page.goto(BASE_URL);
      await page.getByRole('button', { name: 'Select Inventory Clerk role' }).click();
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      // Add a material to produce an audit log entry
      const uniqueName = `Audit Test ${Date.now()}`;
      await page.getByRole('button', { name: 'Inventory (Raw)' }).click();
      await page.getByRole('button', { name: 'Add Material' }).click();
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
      await page.locator('select[name="material_type"]').selectOption('cowhide');
      await page.locator('input[name="quantity"]').fill('10');
      await page.locator('input[name="unit_cost"]').fill('200');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Navigate to Audit Trail
      await page.getByRole('button', { name: 'Home' }).click();
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();

      // Filter by "Material Added" and search for the unique material name
      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('material_added');
      await page.getByPlaceholder('Search details...').fill(uniqueName);

      // At least one log entry should be visible
      await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
    });

  });

});
