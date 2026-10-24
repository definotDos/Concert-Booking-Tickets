import { test, expect } from '@playwright/test';
import 'dotenv/config';

test('admin creates and edits directories, configures seating, publishes and cancels a concert', async ({
  page,
}) => {
  const suffix = Date.now();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel('Email address').fill(process.env.ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Manage', exact: true }).click();
  await page.getByRole('button', { name: 'artists', exact: true }).click();
  await page.getByRole('button', { name: '+ Add artist', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(`QA Artist ${suffix}`);
  await page.getByLabel('Biography').fill('Created by the browser administration test.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  let record = page.locator('.admin-record').filter({ hasText: `QA Artist ${suffix}` });
  await expect(record).toBeVisible();
  await record.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Genre', { exact: true }).fill('Test genre');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(record).toContainText('Test genre');
  await page.getByRole('button', { name: 'venues', exact: true }).click();
  await page.getByRole('button', { name: '+ Add venue', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(`QA Venue ${suffix}`);
  await page.getByLabel('City', { exact: true }).fill('Manila');
  await page.getByLabel('Address', { exact: true }).fill('QA development venue');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('.admin-record').filter({ hasText: `QA Venue ${suffix}` }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'concerts', exact: true }).click();
  await page.getByRole('button', { name: '+ Add concert', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(`QA Concert ${suffix}`);
  await page.locator('select[name="artist"]').selectOption({ label: `QA Artist ${suffix}` });
  await page.locator('select[name="venue"]').selectOption({ label: `QA Venue ${suffix}` });
  const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 16);
  await page.locator('input[name="startsAt"]').fill(future);
  await page.locator('input[name="price0"]').fill('175');
  await page.getByRole('button', { name: 'Save concert', exact: true }).click();
  record = page.locator('.admin-record').filter({ hasText: `QA Concert ${suffix}` });
  await expect(record.locator('.badge')).toHaveText('draft');
  await record.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Description').fill('Edited through the admin UI.');
  await page.getByRole('button', { name: 'Save concert', exact: true }).click();
  await record.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(record.locator('.badge')).toHaveText('published');
  await record.getByRole('button', { name: 'Cancel event', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(record.locator('.badge')).toHaveText('published');
  await record.getByRole('button', { name: 'Cancel event', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(record.locator('.badge')).toHaveText('cancelled');
  await page.getByLabel('Search records').fill(`QA Concert ${suffix}`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByLabel('Filter status').selectOption('cancelled');
  await expect(page.locator('.admin-record')).toHaveCount(1);
  await page.getByLabel('Sort records').selectOption('name');
  await expect(record).toBeVisible();
  await page.getByLabel('Search records').fill('no-matching-record');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('No records yet.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(record).toBeVisible();
  for (const tab of ['users', 'payments', 'bookings', 'overview']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Make the night happen.' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'reports', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report CSV' }).click();
  expect((await download).suggestedFilename()).toBe('encore-report.csv');
  await page.getByRole('button', { name: 'audit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payment event audit log' })).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'overview', exact: true }).click();
  await page.screenshot({ path: '.local/screenshots/admin-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
