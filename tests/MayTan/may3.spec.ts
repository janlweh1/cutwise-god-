import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Log in as admin and navigate to Audit Logs via sidebar. */
async function goToAuditLogs(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('admin@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/admin/);
  await page.getByRole('button', { name: 'Audit Logs' }).click();
  await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
}

/** Log in as supervisor and navigate to Audit Logs via sidebar. */
async function goToAuditLogsAsSupervisor(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('supervisor@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/supervisor/);
  await page.getByRole('button', { name: 'Audit Logs' }).click();
  await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// AUDIT TRAIL — DEEP FILTER & E2E AUDIT GENERATION TESTS
// ─────────────────────────────────────────────────────────────
test.describe('Audit Trail — Deep Filter & Audit Generation', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the Audit Trail heading after navigating via admin sidebar', async ({ page }) => {
      await goToAuditLogs(page);
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should display all expected column headers in the audit log table', async ({ page }) => {
      await goToAuditLogs(page);

      await expect(page.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Details' })).toBeVisible();
    });

    test('should filter by "Supplier Added" action type and remain stable', async ({ page }) => {
      await goToAuditLogs(page);

      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('supplier_added');
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should filter by "Material Edited" action type and remain stable', async ({ page }) => {
      await goToAuditLogs(page);

      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('material_edited');
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should filter by "Material Deleted" action type and remain stable', async ({ page }) => {
      await goToAuditLogs(page);

      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('material_deleted');
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should show the search box placeholder "Search details..."', async ({ page }) => {
      await goToAuditLogs(page);
      await expect(page.getByPlaceholder('Search details...')).toBeVisible();
    });

    test('should show Clear Filters button only when at least one filter is active', async ({ page }) => {
      await goToAuditLogs(page);

      // No filter yet — Clear Filters should not appear
      await expect(page.getByRole('button', { name: 'Clear Filters' })).not.toBeVisible();

      // Apply a search filter
      await page.getByPlaceholder('Search details...').fill('suede');
      await expect(page.getByRole('button', { name: 'Clear Filters' })).toBeVisible();
    });

    test('should reset the action filter to All Actions when Clear Filters is clicked', async ({ page }) => {
      await goToAuditLogs(page);

      // Apply both filters
      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('material_added');
      await page.getByPlaceholder('Search details...').fill('something');

      await page.getByRole('button', { name: 'Clear Filters' }).click();

      // Search box must be empty again
      await expect(page.getByPlaceholder('Search details...')).toHaveValue('');
      // Clear Filters button should disappear
      await expect(page.getByRole('button', { name: 'Clear Filters' })).not.toBeVisible();
    });

    test('supervisor should also be able to view the Audit Logs page', async ({ page }) => {
      await goToAuditLogsAsSupervisor(page);
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('should generate a supplier_added audit entry after adding a new supplier', async ({ page }) => {
      // Log in as clerk and add a supplier
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      const supplierName = `Audit Supplier ${Date.now()}`;
      await page.getByRole('button', { name: 'Suppliers' }).click();
      await page.getByRole('button', { name: 'Add Supplier' }).click();
      await page.locator('input[name="name"]').fill(supplierName);
      await page.locator('form').getByRole('button', { name: 'Add Supplier' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Now log in as admin to check the audit trail
      await page.getByRole('button', { name: 'Sign Out' }).click();
      await page.getByRole('textbox', { name: 'Email Address' }).fill('admin@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/admin/);

      await page.getByRole('button', { name: 'Audit Logs' }).click();
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();

      // Filter by supplier_added and search for the supplier name
      await page.locator('select').filter({ hasText: 'All Actions' }).selectOption('supplier_added');
      await page.getByPlaceholder('Search details...').fill(supplierName);

      // At least one log entry for this action should be present
      await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('clerk should NOT see Audit Logs in the sidebar', async ({ page }) => {
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      // Audit Logs is restricted to admin and supervisor
      await expect(page.getByRole('button', { name: 'Audit Logs' })).not.toBeVisible();
    });

    test('searching for a non-existent detail should return no rows or show empty state', async ({ page }) => {
      await goToAuditLogs(page);

      await page.getByPlaceholder('Search details...').fill('zzz_impossible_audit_xyz_999');

      const rowCount = await page.locator('.data-table tbody tr').count();
      const hasEmpty = await page.locator('.view-empty').isVisible();

      expect(rowCount === 0 || hasEmpty).toBeTruthy();
    });

  });

});
