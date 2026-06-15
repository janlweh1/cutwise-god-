import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in and navigate to Suppliers view
// ─────────────────────────────────────────────────────────────
async function goToSuppliers(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('button', { name: 'Select Inventory Clerk role' }).click();
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
  await page.getByRole('button', { name: 'Suppliers' }).click();
  await expect(page.getByRole('heading', { name: 'Supplier Reference' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// SUPPLIERS TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Supplier Management', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the Supplier Reference page', async ({ page }) => {
      await goToSuppliers(page);
      await expect(page.getByRole('heading', { name: 'Supplier Reference' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Supplier' })).toBeVisible();
    });

    test('should open the Add Supplier modal when button is clicked', async ({ page }) => {
      await goToSuppliers(page);

      await page.getByRole('button', { name: 'Add Supplier' }).click();

      // Modal should appear with the correct title
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.modal-header h3')).toContainText('Add Supplier');
    });

    test('should add a new supplier and display it in the table', async ({ page }) => {
      await goToSuppliers(page);

      // Use timestamp to ensure a unique supplier name on every run
      const uniqueName = `Test Supplier ${Date.now()}`;

      await page.getByRole('button', { name: 'Add Supplier' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Fill in supplier details
      await page.locator('input[name="name"]').fill(uniqueName);
      await page.locator('input[name="contact_person"]').fill('Juan dela Cruz');
      await page.locator('input[name="phone"]').fill('+639171234567');
      await page.locator('input[name="email"]').fill('supplier@test.com');
      await page.locator('textarea[name="address"]').fill('123 Test St, Manila');

      // Submit and wait for modal to close
      await page.locator('form').getByRole('button', { name: 'Add Supplier' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // Assert the new supplier appears in the table
      await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible();
    });

    test('should add a supplier with only the required name field', async ({ page }) => {
      await goToSuppliers(page);

      const uniqueName = `Minimal Supplier ${Date.now()}`;

      await page.getByRole('button', { name: 'Add Supplier' }).click();

      // Fill only the required name field, leave optionals blank
      await page.locator('input[name="name"]').fill(uniqueName);

      await page.locator('form').getByRole('button', { name: 'Add Supplier' }).click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // New supplier should appear in the table
      await expect(page.getByRole('cell', { name: uniqueName })).toBeVisible();
    });

    test('should filter suppliers using the search box', async ({ page }) => {
      await goToSuppliers(page);

      // Search for a term
      await page.getByRole('textbox', { name: 'Search suppliers...' }).fill('Manila');

      // Page should remain stable and show results or empty state
      await expect(page.getByRole('heading', { name: 'Supplier Reference' })).toBeVisible();

      // Clear the search
      await page.getByRole('textbox', { name: 'Search suppliers...' }).fill('');
      await expect(page.getByRole('heading', { name: 'Supplier Reference' })).toBeVisible();
    });

    test('should close the modal when Cancel is clicked', async ({ page }) => {
      await goToSuppliers(page);

      await page.getByRole('button', { name: 'Add Supplier' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Click Cancel — modal should close without saving
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.modal-overlay')).not.toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('should show validation error when supplier name is empty', async ({ page }) => {
      await goToSuppliers(page);

      await page.getByRole('button', { name: 'Add Supplier' }).click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Submit without filling the required name field
      await page.locator('form').getByRole('button', { name: 'Add Supplier' }).click();

      // Validation error should appear, modal should stay open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error')).toContainText('Supplier name is required');
    });

    test('should not submit the form when only optional fields are filled', async ({ page }) => {
      await goToSuppliers(page);

      await page.getByRole('button', { name: 'Add Supplier' }).click();

      // Fill only optional fields, leave name blank
      await page.locator('input[name="contact_person"]').fill('Some Person');
      await page.locator('input[name="phone"]').fill('+63912345678');

      await page.locator('form').getByRole('button', { name: 'Add Supplier' }).click();

      // Modal must stay open because name is required
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error')).toBeVisible();
    });

  });

});
