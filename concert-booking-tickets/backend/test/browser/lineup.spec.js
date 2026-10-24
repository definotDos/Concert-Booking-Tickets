import { test, expect } from '@playwright/test';

test('bands and solo artists filter, persist on reload, and open bookable seats', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.concert-card')).toHaveCount(11);
  await page.getByRole('button', { name: 'Bands', exact: true }).click();
  await expect(page.locator('.concert-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'Solo artists', exact: true }).click();
  await expect(page.locator('.concert-card')).toHaveCount(3);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Solo artists', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.card-artist')).toHaveText(['ZACK TABUDLO', 'LUMI', 'ZILD']);
  await page.getByRole('button', { name: 'List view' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.concert-list')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.concert-card').filter({ hasText: 'ZILD' }).click();
  await expect(page.locator('.detail-heading h1')).toContainText('ZILD');
  await expect(page.locator('button.seat.available').first()).toBeVisible();
});
