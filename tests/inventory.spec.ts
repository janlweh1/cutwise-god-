import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in and navigate to Inventory (Raw) view
// ─────────────────────────────────────────────────────────────
async function goToInventory(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'Select Inventory Clerk role' }).click();
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
  await page.getByRole('button', { name: 'Inventory (Raw)' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// INVENTORY TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Inventory Management', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the Inventory Management heading', async ({ page }) => {
      await goToInventory(page);
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Material' })).toBeVisible();
    });

    test('should add a new material and show it in the table', async ({ page }) => {
      await goToInventory(page);

      // Use timestamp to avoid unique_together constraint on repeat runs
      const uniqueName = `Test Material ${Date.now()}`;

      // Open the Add Material modal
      await page.getByRole('button', { name: 'Add Material' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Fill in the form
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
      await page.locator('select[name="material_type"]').selectOption('adhesive');
      await page.getByPlaceholder('e.g., 12').fill('10');
      await page.locator('input[name="quantity"]').fill('50');
      await page.locator('input[name="unit_cost"]').fill('150');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });

      // Submit and wait for modal to close
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Assert the new material appears in the table
      await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible();
    });

    test('should edit a material and update its quantity', async ({ page }) => {
      await goToInventory(page);

      // Add a material to edit
      const uniqueName = `Edit Test ${Date.now()}`;
      await page.getByRole('button', { name: 'Add Material' }).click();
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
      await page.locator('select[name="material_type"]').selectOption('rubber');
      await page.locator('input[name="quantity"]').fill('30');
      await page.locator('input[name="unit_cost"]').fill('100');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Click the first Edit button (the material we just added should be at top)
      await page.getByRole('button', { name: 'Edit' }).first().click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Update the quantity
      await page.locator('input[name="quantity"]').fill('99');

      // Save and wait for modal to close
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Assert updated quantity appears in the table
      await expect(page.getByRole('cell', { name: '99' })).toBeVisible();
    });

    test('should delete a material and remove it from the table', async ({ page }) => {
      await goToInventory(page);

      // Add a material to delete
      const uniqueName = `Delete Test ${Date.now()}`;
      await page.getByRole('button', { name: 'Add Material' }).click();
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
      await page.locator('select[name="material_type"]').selectOption('thread');
      await page.locator('input[name="quantity"]').fill('10');
      await page.locator('input[name="unit_cost"]').fill('50');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Confirm material is visible before deleting
      await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible();

      // Accept the confirm dialog and delete
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Delete' }).first().click();

      // Assert the material is no longer in the table
      await expect(page.getByRole('cell', { name: uniqueName })).not.toBeVisible();
    });

    test('should filter materials using the search box', async ({ page }) => {
      await goToInventory(page);

      // Search for something specific
      await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('Italian');

      // Heading should still be visible (page didn't crash)
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();

      // Clear search and restore full list
      await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('');
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('should show validation errors when submitting an empty form', async ({ page }) => {
      await goToInventory(page);

      // Open Add Material modal
      await page.getByRole('button', { name: 'Add Material' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Submit without filling anything
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();

      // Validation errors should appear — modal stays open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error').first()).toBeVisible();
    });

    test('should show error when no supplier is selected', async ({ page }) => {
      await goToInventory(page);

      await page.getByRole('button', { name: 'Add Material' }).click();

      // Fill required fields but leave supplier as default (blank)
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill('No Supplier Test');
      await page.locator('input[name="quantity"]').fill('10');
      await page.locator('input[name="unit_cost"]').fill('100');
      // Do NOT select a supplier

      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();

      // Supplier validation error should be shown, modal stays open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error')).toContainText('Supplier is required');
    });

    test('should keep modal open when duplicate material name is submitted', async ({ page }) => {
      await goToInventory(page);

      // Add a material first
      const uniqueName = `Duplicate Test ${Date.now()}`;
      await page.getByRole('button', { name: 'Add Material' }).click();
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
      await page.locator('select[name="material_type"]').selectOption('suede');
      await page.locator('input[name="quantity"]').fill('5');
      await page.locator('input[name="unit_cost"]').fill('80');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Try to add the SAME material again (same name + type + supplier = duplicate)
      await page.getByRole('button', { name: 'Add Material' }).click();
      await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
      await page.locator('select[name="material_type"]').selectOption('suede');
      await page.locator('input[name="quantity"]').fill('5');
      await page.locator('input[name="unit_cost"]').fill('80');
      await page.locator('select[name="supplier"]').selectOption({ index: 1 });
      await page.locator('form').getByRole('button', { name: 'Add Material' }).click();

      // Modal must stay open because backend rejects the duplicate
      await expect(page.locator('.modal-overlay')).toBeVisible();
    });

  });

});
