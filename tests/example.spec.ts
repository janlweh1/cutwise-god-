import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const uniqueName = `Testing Lang ${Date.now()}`; // avoids unique_together constraint on repeat runs
  await page.goto('http://localhost:5173/');
  await page.getByRole('button', { name: 'Select Inventory Clerk role' }).click();
  await page.getByRole('textbox', { name: 'Email Address' }).click();
  await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
  await page.getByRole('textbox', { name: 'Email Address' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: 'Inventory (Raw)' }).click();
  await page.getByRole('button', { name: 'Scrap' }).click();
  await page.getByRole('button', { name: 'Suppliers' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Inventory (Raw)' }).click();
  await page.getByRole('textbox', { name: 'Search by name or type...' }).click();
  await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('Italian');
  await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
  await expect(page.getByRole('heading')).toContainText('Inventory Management');
  await page.getByRole('textbox', { name: 'Search by name or type...' }).click();
  await page.getByRole('textbox', { name: 'Search by name or type...' }).click();
  await page.getByRole('textbox', { name: 'Search by name or type...' }).fill('');
  await page.getByRole('button', { name: 'Add Material' }).click();
  await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).click();
  await page.getByRole('textbox', { name: 'e.g., Full Grain Cowhide' }).fill(uniqueName);
  await page.locator('select[name="material_type"]').selectOption('adhesive');
  await page.getByPlaceholder('e.g., 12').click();
  await page.getByPlaceholder('e.g., 12').fill('15');
  await page.locator('input[name="quantity"]').click();
  await page.locator('input[name="quantity"]').fill('21');
  await page.locator('input[name="unit_cost"]').click();
  await page.locator('input[name="unit_cost"]').fill('230');
  await page.locator('select[name="supplier"]').selectOption({ index: 1 }); // picks the first available supplier
  await page.locator('form').getByRole('button', { name: 'Add Material' }).click();
  // Wait for the modal overlay to close after the async API call completes
  await page.locator('.modal-overlay').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Edit' }).first().click();
  await page.locator('input[name="quantity"]').click();
  await page.locator('input[name="quantity"]').fill('10');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  page.once('dialog', dialog => {
    console.log(`Dialog message: ${dialog.message()}`);
    dialog.accept().catch(() => { }); // accept the confirm dialog to actually delete
  });
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await page.getByRole('button', { name: 'Sign Out' }).click();
});