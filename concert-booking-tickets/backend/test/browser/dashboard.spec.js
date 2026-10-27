import { test, expect } from '@playwright/test';
import 'dotenv/config';

test('dashboard shortcuts, reloads, payments and responsive sections work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email address').fill(process.env.ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Manage', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coming up next' })).toBeVisible();
  await page.getByRole('link', { name: /draft concerts/ }).click();
  await expect(page.getByLabel('Filter status')).toHaveValue('draft');
  await page.reload();
  await expect(page.getByLabel('Filter status')).toHaveValue('draft');
  await page.getByRole('button', { name: 'overview', exact: true }).click();
  await page.getByRole('link', { name: /refunds required/ }).click();
  await expect(page.getByLabel('Filter status')).toHaveValue('refund_required');
  await page.getByRole('button', { name: 'payments', exact: true }).click();
  await expect(page.getByText(/matching records/)).toBeVisible();
  await page.getByRole('button', { name: 'overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coming up next' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh data' }).click();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/screenshots/dashboard-${width}.png`, fullPage: true });
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(errors).toEqual([]);
});
