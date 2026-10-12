import { expect, test } from '@playwright/test';

test('home page shows catalog counts from the generated catalog', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: '.NET Config Wizard' })).toBeVisible();
	await expect(page.getByTestId('catalog-summary')).toContainText('build-enforced rules from SDK 10.0.300');
});
