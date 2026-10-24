import { test, expect } from '@playwright/test';
import 'dotenv/config';
test('browser: register → seat hold → sandbox payment → ticket download → staff entry', async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Be there.' })).toBeVisible();
  await expect(page.locator('.concert-card').first()).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/discover-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Full name').fill('Browser Test');
  await page.getByLabel('Email address').fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Browser-test-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('link', { name: 'My tickets' })).toBeVisible();
  await page.locator('.concert-card').first().click();
  await expect(page.getByRole('heading', { name: 'Pick your perspective.' })).toBeVisible();
  const eventTitle = await page.locator('.detail-heading h1').innerText();
  const eventId = page.url().split('/').at(-1);
  await page.locator('button.seat.available:not(:disabled)').first().click();
  await page.getByRole('button', { name: 'Reserve seats' }).click();
  await expect(page.getByRole('heading', { name: 'Your seats are on hold' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByText('Development payment sandbox', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'success', exact: true }).click();
  await expect(page.locator('.ticket-card')).toHaveCount(1);
  await expect(page.locator('.ticket-card h2')).toHaveText(eventTitle);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download ticket' }).click();
  expect((await download).suggestedFilename()).toMatch(/^TKT-.*\.png$/);
  await page.getByText('Ticket scanner code', { exact: true }).click();
  const token = await page.locator('.token').innerText();
  await page.screenshot({ path: '.local/screenshots/ticket-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Booking history' }).click();
  await expect(page.locator('.booking-history')).toHaveCount(1);
  await page.getByRole('button', { name: 'Digital tickets' }).click();
  await expect(page.locator('.ticket-card')).toHaveCount(1);
  const context = await browser.newContext();
  const staff = await context.newPage();
  await staff.goto('http://localhost:5173/login');
  await staff.getByLabel('Email address').fill(process.env.ADMIN_EMAIL);
  await staff.getByLabel('Password', { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await staff.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await staff.getByRole('link', { name: 'Check-in', exact: true }).click();
  await staff.getByLabel('Event', { exact: true }).selectOption(eventId);
  await staff.getByLabel('QR scanner code').fill(token);
  await staff.getByRole('button', { name: 'Verify & admit' }).click();
  await expect(staff.locator('.scan-result')).toContainText('Entry accepted');
  await staff.getByLabel('QR scanner code').fill(token);
  await staff.getByRole('button', { name: 'Verify & admit' }).click();
  await expect(staff.locator('.scan-result')).toContainText('already been used');
  await staff.getByRole('link', { name: 'Manage', exact: true }).click();
  await expect(staff.getByText('VERIFIED PAYMENT REVENUE')).toBeVisible();
  await context.close();
  expect(errors).toEqual([]);
});
test('mobile discovery, filters, seat map and login have no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.concert-card').first()).toBeVisible();
  await page.getByLabel('Search concerts or artists').fill('no-such-concert');
  await page.getByRole('button', { name: 'Find a show' }).click();
  await expect(page.getByRole('heading', { name: 'No shows match just yet' })).toBeVisible();
  await page.getByLabel('Search concerts or artists').fill('');
  await page.getByRole('button', { name: 'Find a show' }).click();
  await expect(page.locator('.concert-card').first()).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/discover-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.locator('.concert-card').first().click();
  await expect(page.locator('.seat').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.local/screenshots/seats-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name: 'Sign in' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
