import { expect, test } from '@playwright/test';

test('the rules index links to a prerendered rule page with how to configure it', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Rules' }).click();
	await page.getByRole('textbox', { name: 'Search rules' }).fill('CA2007');

	await page.getByRole('link', { name: 'CA2007', exact: true }).click();

	await expect(page.getByRole('heading', { level: 1 })).toHaveText('CA2007: Consider calling ConfigureAwait on the awaited task');
	await expect(page.getByText('dotnet_diagnostic.CA2007.severity = warning')).toBeVisible();
	await expect(page.getByText('ConfigureAwait is also checked by MA0004, RCS1090')).toBeVisible();
});

test('an option page shows its values, example and attribution', async ({ page }) => {
	await page.goto('/options/csharp_style_namespace_declarations');

	await expect(page.getByText('file_scoped', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'IDE0161' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'CC BY 4.0' })).toBeVisible();
});
