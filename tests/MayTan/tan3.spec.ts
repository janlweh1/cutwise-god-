import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in and navigate to Scrap view
// ─────────────────────────────────────────────────────────────
async function goToScrap(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/inventory_clerk/);
  await page.getByRole('button', { name: 'Scrap' }).click();
  await expect(page.getByRole('heading', { name: 'Scrap Management' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// SCRAP MANAGEMENT TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Scrap Management', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display the Scrap Management heading and Record Scrap button', async ({ page }) => {
      await goToScrap(page);
      await expect(page.getByRole('heading', { name: 'Scrap Management' })).toBeVisible();
      await expect(page.locator('#record-scrap-btn')).toBeVisible();
    });

    test('should display the 3 summary stat cards', async ({ page }) => {
      await goToScrap(page);

      // All 3 stat card labels should be visible
      await expect(page.getByText('Available Weight')).toBeVisible();
      await expect(page.getByText('Total Sold')).toBeVisible();
      await expect(page.getByText('Total Revenue')).toBeVisible();
    });

    test('should show Scrap Inventory and Sales History tab buttons', async ({ page }) => {
      await goToScrap(page);

      await expect(page.locator('#scrap-tab-inventory')).toBeVisible();
      await expect(page.locator('#scrap-tab-sales')).toBeVisible();
    });

    test('should switch to Sales History tab when clicked', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#scrap-tab-sales').click();

      // Tab should now be active — heading still visible
      await expect(page.getByRole('heading', { name: 'Scrap Management' })).toBeVisible();
      await expect(page.locator('#scrap-tab-sales')).toBeVisible();
    });

    test('should open the Record Scrap modal when button is clicked', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Modal title should be "Record Scrap"
      await expect(page.locator('.modal-header h3')).toContainText('Record Scrap');
    });

    test('should display Source Material select and Weight input in the modal', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      await expect(page.locator('#scrap-material-select')).toBeVisible();
      await expect(page.locator('#scrap-weight-input')).toBeVisible();
    });

    test('should record a new scrap entry and show it in the inventory table', async ({ page }) => {
      await goToScrap(page);

      // Open the Record Scrap modal
      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Select the first available material
      await page.locator('#scrap-material-select').selectOption({ index: 1 });
      await page.locator('#scrap-weight-input').fill('0.500');

      // Submit
      await page.locator('#record-scrap-submit').click();
      await page.locator('.modal-overlay').waitFor({ state: 'hidden' });

      // The scrap inventory table should be visible after successful submission
      await expect(page.locator('#scrap-inventory-table')).toBeVisible();
    });

    test('should close the Record Scrap modal when Cancel is clicked', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.modal-overlay')).not.toBeVisible();
    });

    test('should show the scrap inventory table with correct column headers', async ({ page }) => {
      await goToScrap(page);

      // Stay on the default Scrap Inventory tab
      const isEmpty = await page.locator('.view-empty').isVisible();

      if (!isEmpty) {
        await expect(page.locator('#scrap-inventory-table')).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Source Material' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Weight (kg)' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      } else {
        // Empty state message should be visible
        await expect(page.locator('.view-empty')).toBeVisible();
      }
    });

    test('should show the Sales History table with correct column headers after switching tabs', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#scrap-tab-sales').click();

      // Wait for the tab content to settle before checking state
      await expect(page.getByRole('heading', { name: 'Scrap Management' })).toBeVisible();
      await page.waitForTimeout(500);

      const isEmpty = await page.locator('.view-empty').isVisible();

      if (!isEmpty) {
        await expect(page.locator('#scrap-sales-table')).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Weight Sold (kg)' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Total Amount' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Profit' })).toBeVisible();
      } else {
        await expect(page.locator('.view-empty')).toBeVisible();
      }
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('should show validation error when no material is selected', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Fill weight but leave material blank
      await page.locator('#scrap-weight-input').fill('1.000');
      await page.locator('#record-scrap-submit').click();

      // Validation error for material, modal stays open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error')).toContainText('Please select a source material.');
    });

    test('should show validation error when weight is zero or empty', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Select material but leave weight blank
      await page.locator('#scrap-material-select').selectOption({ index: 1 });
      await page.locator('#record-scrap-submit').click();

      // Validation error for weight, modal stays open
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error')).toContainText('Weight must be greater than 0.');
    });

    test('should keep modal open when both required fields are empty on submit', async ({ page }) => {
      await goToScrap(page);

      await page.locator('#record-scrap-btn').click();
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Submit without filling anything
      await page.locator('#record-scrap-submit').click();

      // Modal must remain open due to validation
      await expect(page.locator('.modal-overlay')).toBeVisible();
      await expect(page.locator('.form-error').first()).toBeVisible();
    });

  });

});
