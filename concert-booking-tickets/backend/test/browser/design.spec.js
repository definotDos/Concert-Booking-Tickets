import { test, expect } from '@playwright/test';

test('design: signup, profile persistence, mobile menu and protected roles', async ({ page }) => {
  await page.goto('/login?mode=register');
  await page.getByLabel('Full name').fill('Design QA');
  await page.getByLabel('Email address').fill(`design-${Date.now()}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill('Design-test-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByLabel('Full name').fill('Updated Design QA');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Updated Design QA');
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.concert-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--midnight')
          .trim()
          .toLowerCase(),
      ),
    ).toBe('#080b1a');
    if (width === 360) {
      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await expect(page.getByRole('link', { name: 'My tickets' })).toBeVisible();
      await page.getByRole('link', { name: 'My tickets' }).click();
      await expect(page.getByRole('heading', { name: 'Your next encore.' })).toBeVisible();
    }
  }
  for (const route of ['/admin', '/staff']) {
    await page.goto(route);
    await expect(page.getByText('You do not have access to this page.')).toBeVisible();
  }
});
