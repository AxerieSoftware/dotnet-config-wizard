import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

test('a formatting choice shows in the live preview', async ({ page }) => {
	await page.goto('/wizard/formatting');

	await page.getByRole('combobox', { name: 'C# files: Indent style' }).selectOption('tab');

	await expect(page.getByTestId('file-.editorconfig')).toContainText('#### C# files ####\n[*.cs]\nindent_style = tab');
});

test('code-style choices carry through to the downloaded zip', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Start' }).click();
	await page.getByRole('link', { name: 'Code style' }).first().click();

	await page.getByRole('combobox', { name: 'dotnet_style_qualification_for_field', exact: true }).selectOption('true');
	await page.getByRole('combobox', { name: 'IDE0009 severity' }).selectOption('warning');
	await page.getByRole('link', { name: 'Review and export' }).first().click();

	const reviewFile = page.getByTestId('file-.editorconfig');
	await expect(reviewFile).toContainText('## this. and Me. qualification (IDE0003, IDE0009)\ndotnet_style_qualification_for_field = true');
	await expect(reviewFile).toContainText('# IDE0009: Member access should be qualified\ndotnet_diagnostic.IDE0009.severity = warning');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download zip' }).click();
	const download = await downloadPromise;
	const files = unzipSync(await readFile(await download.path()));

	expect(download.suggestedFilename()).toBe('dotnet-config.zip');
	expect(Object.keys(files)).toEqual(['.editorconfig']);
	expect(strFromU8(files['.editorconfig'])).toBe(await reviewFile.textContent());
});

test('rules the build never runs are labeled editor only', async ({ page }) => {
	await page.goto('/wizard/code-style');

	await expect(page.locator('.rule-row', { hasText: 'IDE0003' }).getByText('Editor only')).toBeVisible();
});

test('a rule that needs a newer C# than the target framework is hidden until asked', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('combobox', { name: 'SDK band' }).selectOption('11.0.1xx');
	await page.getByRole('checkbox', { name: 'net11.0' }).uncheck();
	await page.getByRole('checkbox', { name: 'net10.0' }).check();
	await expect(page.getByTestId('effective-csharp')).toHaveText('Code compiles as C# 14.0.');
	await page.getByRole('link', { name: 'Code style' }).first().click();

	await expect(page.getByRole('combobox', { name: 'IDE0410 severity' })).toHaveCount(0);

	await page.getByRole('checkbox', { name: /Show options and rules/ }).check();

	await expect(page.getByRole('combobox', { name: 'IDE0410 severity' })).toBeDisabled();
	await expect(page.locator('.rule-row', { hasText: 'IDE0410' }).getByText('Needs C# 15.0')).toBeVisible();
});

test('switching to the preview SDK updates the file header', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('combobox', { name: 'SDK band' }).selectOption('11.0.1xx');

	await expect(page.getByTestId('file-.editorconfig')).toContainText('# Settings for .NET SDK 11.0.1xx');
});

test('a naming template adds a complete rule, symbol group and style', async ({ page }) => {
	await page.goto('/wizard/naming');

	await page.getByRole('button', { name: 'interfaces' }).click();

	const preview = page.getByTestId('file-.editorconfig');
	await expect(preview).toContainText('dotnet_naming_rule.interfaces_should_be_prefix_i_pascal_case.symbols = interfaces');
	await expect(preview).toContainText('dotnet_naming_symbols.interfaces.applicable_kinds = interface');
	await expect(preview).toContainText('dotnet_naming_style.prefix_i_pascal_case.required_prefix = I');
});
