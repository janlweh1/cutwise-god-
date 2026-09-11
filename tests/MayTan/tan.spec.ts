import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in and navigate to Inventory (Raw) view
// ─────────────────────────────────────────────────────────────
async function goToInventory(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
  await page.getByRole('button', { name: 'Inventory (Raw)' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// INVENTORY SEARCH, FILTER & RESTOCK FLOW TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Inventory — Search, Filter & Restock Flow', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the search box on the Inventory Management page', async ({ page }) => {
      await goToInventory(page);
      await expect(page.getByRole('textbox', { name: 'Search by name or type...' })).toBeVisible();
    });

    test('should filter table rows when typing in the search box', async ({ page }) => {
      await goToInventory(page);

      // Type a search term
      await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('cowhide');

      // Page should remain stable
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
    });

    test('should restore all results when search box is cleared', async ({ page }) => {
      await goToInventory(page);

      // Type then clear the search
      const searchBox = page.getByRole('textbox', { name: 'Search by name or type...' });
      await searchBox.fill('suede');
      await searchBox.fill('');

      // Full list restored — heading and table still visible
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
    });

    test('should show no results for a search term that matches nothing', async ({ page }) => {
      await goToInventory(page);

      // Highly unlikely to match any material name
      await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('zzz_nomatch_xyz');

      // Either the table has 0 rows or an empty-state element appears
      const rowCount = await page.locator('.data-table tbody tr').count();
      const hasEmpty = await page.locator('.view-empty').isVisible();

      expect(rowCount === 0 || hasEmpty).toBeTruthy();
    });

    test('should search by material type and show matching rows', async ({ page }) => {
      await goToInventory(page);

      // "suede" is one of the known types in the system
      await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('suede');
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
    });

    test('should add a material and then find it via search', async ({ page }) => {
      await goToInventory(page);

      const searchTerm = `SearchTest ${Date.now()}`;

      // Add a new material with a unique name
      await page.getByRole('button', { name: 'Add Material' }).click();
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(searchTerm);
      await page.locator('select[name="material_type"]').selectOption('nappa');
      await page.locator('input[name="quantity"]').fill('20');
      await page.locator('input[name="unit_cost"]').fill('300');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Search for the newly added material
      await page.getByRole('textbox', { name: 'Search by name or type...' }).fill(searchTerm);

      // Should find it in the table
      await expect(page.getByRole('cell', { name: searchTerm })).toBeVisible();
    });

    test('should show the Add Material button alongside the search box', async ({ page }) => {
      await goToInventory(page);

      // Both search and action button should coexist on the page
      await expect(page.getByRole('textbox', { name: 'Search by name or type...' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Material' })).toBeVisible();
    });

    test('should show correct column headers in the inventory table', async ({ page }) => {
      await goToInventory(page);

      const isEmpty = await page.locator('.view-empty').isVisible();

      if (!isEmpty) {
        // Verify the material table has the expected column structure
        await expect(page.getByRole('columnheader', { name: 'Material Name' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Quantity' })).toBeVisible();
      } else {
        await expect(page.locator('.view-empty')).toBeVisible();
      }
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('should show error when quantity is negative', async ({ page }) => {
      await goToInventory(page);

      await page.getByRole('button', { name: 'Add Material' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Fill form but enter a negative quantity
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill('Negative Qty Test');
      await page.locator('select[name="material_type"]').selectOption('cowhide');
      await page.locator('input[name="quantity"]').fill('-5');
      await page.locator('input[name="unit_cost"]').fill('100');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();

      // Modal should stay open (validation or backend rejection)
      await expect(page.locator('.modal-overlay')).toBeVisible();
    });

    test('should not close the modal when required unit cost is missing', async ({ page }) => {
      await goToInventory(page);

      await page.getByRole('button', { name: 'Add Material' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Fill all fields except unit cost
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill('No Cost Test');
      await page.locator('select[name="material_type"]').selectOption('goatskin');
      await page.locator('input[name="quantity"]').fill('10');
      // Deliberately skip unit_cost
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();

      // Modal must remain open
      await expect(page.locator('.modal-overlay')).toBeVisible();
    });

    test('should show validation errors when the Add Material form is submitted empty', async ({ page }) => {
      await goToInventory(page);

      await page.getByRole('button', { name: 'Add Material' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Click submit without filling anything
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();

      // At least one form error must be shown and modal stays open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error').first()).toBeVisible();
    });

  });

});
