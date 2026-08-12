import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Log in as Admin — Analytics & AI are only visible to supervisor/admin. */
async function loginAsAdmin(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('admin@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/admin/);
}

/** Log in as Supervisor — also has access to Analytics & AI. */
async function loginAsSupervisor(page: Page) {
  await page.goto(BASE_URL);
  await page.getByRole('textbox', { name: 'Email Address' }).fill('supervisor@otto.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/dashboard\/supervisor/);
}

/** Navigate to the Analytics & AI view from the admin dashboard sidebar. */
async function goToAnalytics(page: Page) {
  await loginAsAdmin(page);
  await page.getByRole('button', { name: 'Analytics & AI' }).click();
  // The heading should be visible after navigation
  await expect(page.getByRole('heading', { name: 'Analytics & AI Predictions' })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS VIEW TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('Analytics & AI View', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should display "Analytics & AI Predictions" heading on navigation', async ({ page }) => {
      await goToAnalytics(page);
      await expect(page.getByRole('heading', { name: 'Analytics & AI Predictions' })).toBeVisible();
    });

    test('should show the 4 tab navigation buttons', async ({ page }) => {
      await goToAnalytics(page);

      await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'AI Predictions' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Risk Scores' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'User Activity' })).toBeVisible();
    });

    test('Overview tab — should display 6 KPI cards', async ({ page }) => {
      await goToAnalytics(page);

      // Overview is the default/active tab — wait for content to load
      await page.waitForLoadState('networkidle');

      // Six KPI metric labels must appear
      await expect(page.getByText('Total Materials', { exact: false })).toBeVisible();
      await expect(page.getByText('Inventory Value',  { exact: false })).toBeVisible();
      await expect(page.getByText('Critical Risk',    { exact: false })).toBeVisible();
      await expect(page.getByText('Reorder Needed',   { exact: false })).toBeVisible();
      await expect(page.getByText('At-Risk Items',    { exact: false })).toBeVisible();
      await expect(page.getByText('Avg Days to Min Stock', { exact: false })).toBeVisible();
    });

    test('Overview tab — should render Stock Status Distribution chart card', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Stock Status Distribution')).toBeVisible();
    });

    test('Overview tab — should render Action Distribution chart card', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Action Distribution')).toBeVisible();
    });

    test('Overview tab — should render Daily Activity Trend chart card', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await expect(page.getByText('Daily Activity Trend')).toBeVisible();
    });

    test('AI Predictions tab — should switch and show prediction table headers', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'AI Predictions' }).click();

      // Table headers unique to the predictions tab
      await expect(page.getByRole('columnheader', { name: 'Material' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Days to Min' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Reorder?' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Confidence' })).toBeVisible();
    });

    test('AI Predictions tab — should show "Reorders Needed" badge', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'AI Predictions' }).click();
      // The badge text matches "[N] Reorders Needed"
      await expect(page.getByText(/Reorders Needed/)).toBeVisible();
    });

    test('AI Predictions tab — should show model info footer', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'AI Predictions' }).click();
      await expect(page.getByText(/Linear Regression/)).toBeVisible();
    });

    test('Risk Scores tab — should switch and show 4 risk-level counter boxes', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Risk Scores' }).click();

      // Each risk level label should be visible
      await expect(page.getByText('CRITICAL')).toBeVisible();
      await expect(page.getByText('HIGH')).toBeVisible();
      await expect(page.getByText('MEDIUM')).toBeVisible();
      await expect(page.getByText('LOW')).toBeVisible();
    });

    test('Risk Scores tab — should render Material Risk Scores chart card', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Risk Scores' }).click();
      await expect(page.getByText('Material Risk Scores')).toBeVisible();
    });

    test('Risk Scores tab — should display risk table with correct column headers', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'Risk Scores' }).click();

      await expect(page.getByRole('columnheader', { name: 'Risk Score' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Risk Level' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Stock Status' })).toBeVisible();
    });

    test('User Activity tab — should switch and show User Activity chart card', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'User Activity' }).click();
      await expect(page.getByText('User Activity')).toBeVisible();
    });

    test('User Activity tab — should show Action Type Distribution card', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'User Activity' }).click();
      await expect(page.getByText('Action Type Distribution')).toBeVisible();
    });

    test('User Activity tab — should display user activity table headers', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      await page.getByRole('button', { name: 'User Activity' }).click();

      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Total Actions' })).toBeVisible();
    });

    test('supervisor can also access Analytics & AI view', async ({ page }) => {
      await loginAsSupervisor(page);
      await page.getByRole('button', { name: 'Analytics & AI' }).click();
      await expect(page.getByRole('heading', { name: 'Analytics & AI Predictions' })).toBeVisible();
    });

    test('tab navigation is stateful — switching back restores the Overview', async ({ page }) => {
      await goToAnalytics(page);
      await page.waitForLoadState('networkidle');

      // Go to Risk Scores
      await page.getByRole('button', { name: 'Risk Scores' }).click();
      await expect(page.getByText('Material Risk Scores')).toBeVisible();

      // Go back to Overview
      await page.getByRole('button', { name: 'Overview' }).click();
      await expect(page.getByText('Stock Status Distribution')).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('inventory clerk should NOT see "Analytics & AI" sidebar link', async ({ page }) => {
      // Clerk role is excluded from analytics
      await page.goto(BASE_URL);
      await page.getByRole('textbox', { name: 'Email Address' }).fill('clerk@otto.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('password123');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await expect(page).toHaveURL(/dashboard\/inventory_clerk/);

      await expect(page.getByRole('button', { name: 'Analytics & AI' })).not.toBeVisible();
    });

    test('unauthenticated user should be redirected to login page', async ({ page }) => {
      // Try to access dashboard directly without logging in
      await page.goto(`${BASE_URL}/dashboard/admin`);
      // Should land back at login
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

  });

});

// ─────────────────────────────────────────────────────────────
// AI ASSISTANT FLOAT TEST SUITE
// ─────────────────────────────────────────────────────────────
test.describe('AI Assistant Float (CutWise AI)', () => {

  // ── Positive Scenarios ──────────────────────────────────────
  test.describe('Positive Scenarios', () => {

    test('should render the floating AI button on the admin dashboard', async ({ page }) => {
      await loginAsAdmin(page);
      await expect(page.locator('#ai-assistant-float-btn')).toBeVisible();
    });

    test('should open the chat popup when the float button is clicked', async ({ page }) => {
      await loginAsAdmin(page);

      await page.locator('#ai-assistant-float-btn').click();
      await expect(page.locator('#ai-assistant-popup')).toBeVisible();
    });

    test('should display "CutWise AI Assistant" header inside the popup', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await expect(page.getByText('CutWise AI Assistant')).toBeVisible();
    });

    test('should show "Powered by Gemini Flash · RAG Pipeline" subtitle', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await expect(page.getByText(/Powered by Gemini Flash/)).toBeVisible();
    });

    test('should display the 4 suggested prompt buttons in the empty state', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await expect(page.getByText('Which materials are critically low on stock?')).toBeVisible();
      await expect(page.getByText('What should I reorder this week?')).toBeVisible();
      await expect(page.getByText('Summarize the current inventory risk.')).toBeVisible();
      await expect(page.getByText('Which suppliers have the most at-risk materials?')).toBeVisible();
    });

    test('should display the "Ask about inventory" empty state heading', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await expect(page.getByText('Ask about your inventory')).toBeVisible();
    });

    test('should focus the textarea input when the popup opens', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      // Small wait for focus timeout (120ms in component)
      await page.waitForTimeout(200);
      await expect(page.locator('#ai-chat-input')).toBeFocused();
    });

    test('should close the popup when the float button is clicked again', async ({ page }) => {
      await loginAsAdmin(page);

      await page.locator('#ai-assistant-float-btn').click();
      await expect(page.locator('#ai-assistant-popup')).toBeVisible();

      // Click again to toggle close
      await page.locator('#ai-assistant-float-btn').click();
      await expect(page.locator('#ai-assistant-popup')).not.toBeVisible();
    });

    test('should show a user message bubble after typing and pressing Enter', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Which materials are critically low?');
      await page.locator('#ai-chat-input').press('Enter');

      // User bubble should appear immediately
      await expect(page.getByText('Which materials are critically low?')).toBeVisible();
    });

    test('should show the "You" label above the user message bubble', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Test question');
      await page.locator('#ai-chat-input').press('Enter');

      await expect(page.getByText('You')).toBeVisible();
    });

    test('should clear the input box after sending a message', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('How many materials are at risk?');
      await page.locator('#ai-chat-input').press('Enter');

      // Input should be emptied immediately
      await expect(page.locator('#ai-chat-input')).toHaveValue('');
    });

    test('send button should be disabled when input is empty', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      // Input starts empty — send button must be disabled
      await expect(page.locator('.ai-send-btn')).toBeDisabled();
    });

    test('send button should become enabled when input has text', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('test');
      await expect(page.locator('.ai-send-btn')).toBeEnabled();
    });

    test('clicking a suggestion prompt should immediately send the message', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      const suggestion = 'What should I reorder this week?';
      await page.getByText(suggestion).click();

      // The message should appear in the chat thread as a user bubble
      await expect(page.getByText(suggestion)).toBeVisible();
    });

    test('should show typing indicator (✦ CutWise AI label) while waiting for AI response', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Summarize the current inventory risk.');
      await page.locator('#ai-chat-input').press('Enter');

      // The CutWise AI label appears for both the typing indicator and the actual reply
      await expect(page.getByText('✦ CutWise AI')).toBeVisible({ timeout: 5000 });
    });

    test('should display "Clear" button in header after sending a message', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Test');
      await page.locator('#ai-chat-input').press('Enter');

      // Clear button only appears when messages.length > 0
      await expect(page.locator('.ai-clear-btn')).toBeVisible();
    });

    test('clicking Clear should remove all messages and restore the empty state', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Test');
      await page.locator('#ai-chat-input').press('Enter');

      // Wait for Clear button then click it
      await expect(page.locator('.ai-clear-btn')).toBeVisible();
      await page.locator('.ai-clear-btn').click();

      // Should return to empty state
      await expect(page.getByText('Ask about your inventory')).toBeVisible();
    });

    test('notification dot should appear on float button when popup is closed with messages', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      // Send a message (user bubble added immediately)
      await page.locator('#ai-chat-input').fill('Test message for dot');
      await page.locator('#ai-chat-input').press('Enter');

      // Close the popup
      await page.locator('#ai-assistant-float-btn').click();

      // The green notification dot (span inside the float btn) should now be visible
      const notifDot = page.locator('#ai-assistant-float-btn span');
      await expect(notifDot).toBeVisible();
    });

    test('reopening the popup after closing should preserve conversation history', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Persistent message');
      await page.locator('#ai-chat-input').press('Enter');

      // Close, then reopen
      await page.locator('#ai-assistant-float-btn').click();
      await page.locator('#ai-assistant-float-btn').click();

      await expect(page.getByText('Persistent message')).toBeVisible();
    });

    test('AI Assistant float button should also be visible on Analytics view', async ({ page }) => {
      await goToAnalytics(page);
      await expect(page.locator('#ai-assistant-float-btn')).toBeVisible();
    });

  });

  // ── Negative Scenarios ──────────────────────────────────────
  test.describe('Negative Scenarios', () => {

    test('pressing Enter on empty input should NOT send a message', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      // No text — press Enter
      await page.locator('#ai-chat-input').press('Enter');

      // The "You" label should NOT appear (no message was added)
      await expect(page.getByText('You')).not.toBeVisible();
      // Empty state heading should still be shown
      await expect(page.getByText('Ask about your inventory')).toBeVisible();
    });

    test('pressing Shift+Enter should insert a newline instead of sending', async ({ page }) => {
      await loginAsAdmin(page);
      await page.locator('#ai-assistant-float-btn').click();

      await page.locator('#ai-chat-input').fill('Line 1');
      await page.locator('#ai-chat-input').press('Shift+Enter');
      // Cursor moves to next line — no message sent yet
      await expect(page.getByText('You')).not.toBeVisible();
    });

    test('AI Assistant float button should NOT appear on the login page', async ({ page }) => {
      await page.goto(BASE_URL);
      await expect(page.locator('#ai-assistant-float-btn')).not.toBeVisible();
    });

  });

});
