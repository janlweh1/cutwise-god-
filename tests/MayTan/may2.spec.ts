import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helper: log in as Supervisor and land on home dashboard
// ─────────────────────────────────────────────────────────────
async function loginAsSupervisor(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('supervisor@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/supervisor/);
}

// ─────────────────────────────────────────────────────────────
// SUPERVISOR DASHBOARD TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Supervisor Dashboard', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should land on the supervisor dashboard after login', async ({ page }) => {
      await loginAsSupervisor(page);
      await expect(page).toHaveURL(/dashboard\/supervisor/);
    });

    test('should display the Inventory (Raw) sidebar button', async ({ page }) => {
      await loginAsSupervisor(page);
      await expect(page.getByRole('button', { name: 'Inventory (Raw)' })).toBeVisible();
    });

    test('should display the Scrap sidebar button', async ({ page }) => {
      await loginAsSupervisor(page);
      await expect(page.getByRole('button', { name: 'Scrap' })).toBeVisible();
    });

    test('should display the Suppliers sidebar button', async ({ page }) => {
      await loginAsSupervisor(page);
      await expect(page.getByRole('button', { name: 'Suppliers' })).toBeVisible();
    });

    test('should display the Analytics & AI sidebar button', async ({ page }) => {
      await loginAsSupervisor(page);
      await expect(page.getByRole('button', { name: 'Analytics & AI' })).toBeVisible();
    });

    test('should navigate to the Inventory Management view from supervisor sidebar', async ({ page }) => {
      await loginAsSupervisor(page);

      await page.getByRole('button', { name: 'Inventory (Raw)' }).click();
      await expect(page.getByRole('heading', { name: 'Inventory Management' })).toBeVisible();
    });

    test('should navigate to the Scrap Management view from supervisor sidebar', async ({ page }) => {
      await loginAsSupervisor(page);

      await page.getByRole('button', { name: 'Scrap' }).click();
      await expect(page.getByRole('heading', { name: 'Scrap Management' })).toBeVisible();
    });

    test('should navigate to the Supplier Reference view from supervisor sidebar', async ({ page }) => {
      await loginAsSupervisor(page);

      await page.getByRole('button', { name: 'Suppliers' }).click();
      await expect(page.getByRole('heading', { name: 'Supplier Reference' })).toBeVisible();
    });

    test('should navigate to Analytics & AI view from supervisor sidebar', async ({ page }) => {
      await loginAsSupervisor(page);

      await page.getByRole('button', { name: 'Analytics & AI' }).click();
      await expect(page.getByRole('heading', { name: 'Analytics & AI Predictions' })).toBeVisible();
    });

    test('supervisor home — should display the Audit Trail heading on the Home tab', async ({ page }) => {
      await loginAsSupervisor(page);

      // Home is the default view
      await page.getByRole('button', { name: 'Home' }).click();
      await expect(page.getByRole('heading', { name: 'Audit Trail' })).toBeVisible();
    });

    test('supervisor should be able to sign out and return to login page', async ({ page }) => {
      await loginAsSupervisor(page);

      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Should be back on the login page
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('supervisor should NOT see the Configuration sidebar button', async ({ page }) => {
      await loginAsSupervisor(page);

      // Configuration is admin-only
      await expect(page.getByRole('button', { name: 'Configuration' })).not.toBeVisible();
    });

    test('supervisor session should not persist after sign out', async ({ page }) => {
      await loginAsSupervisor(page);
      await page.getByRole('button', { name: 'Sign Out' }).click();

      // Try to navigate directly to the supervisor dashboard — should redirect to login
      await page.goto(`${BASE_URL}/dashboard/supervisor`);
      await expect(page).toHaveURL(BASE_URL + '/');
    });

    test('login page should not show the AI assistant float button', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator('#ai-assistant-float-btn')).not.toBeVisible();
    });

  });

});
