import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';

test('a formatting choice shows in the live preview', async ({ page }) => {
	await page.goto('/wizard/formatting');

	await page.getByRole('combobox', { name: 'C# files: Indent style' }).selectOption('tab');

	await expect(page.getByTestId('preview-file')).toContainText('#### C# files ####\n[*.cs]\nindent_style = tab');
});

test('code-style choices carry through to the downloaded .editorconfig', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Start' }).click();
	await page.getByRole('link', { name: 'Code style' }).first().click();

	await page.getByRole('combobox', { name: 'dotnet_style_qualification_for_field', exact: true }).selectOption('true');
	await page.getByRole('combobox', { name: 'IDE0009 severity' }).selectOption('warning');
	await page.getByRole('link', { name: 'Review and export' }).first().click();

	const reviewFile = page.getByTestId('review-file');
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

	const ruleRow = page.locator('.rule-row', { hasText: 'IDE0003' });

	await expect(ruleRow.getByText('Editor only')).toBeVisible();
});
