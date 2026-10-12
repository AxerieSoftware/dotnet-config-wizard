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
	expect(Object.keys(files)).toEqual(['.editorconfig', '.gitattributes']);
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
	await expect(page.getByTestId('effective-csharp')).toContainText('Code compiles as C# 14.0');
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

test('a package rule severity set in the rule browser lands in the exported files', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	await page.getByRole('textbox', { name: 'Search rules' }).fill('MA0004');

	await page.getByRole('combobox', { name: 'MA0004 severity' }).selectOption('error');
	await page.getByRole('link', { name: 'Review and export' }).first().click();

	await expect(page.getByTestId('file-.editorconfig')).toContainText('## Meziantou.Analyzer: Usage\n# MA0004: Use Task.ConfigureAwait\ndotnet_diagnostic.MA0004.severity = error');
});

test('turning off duplicates leaves one active rule per concern', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	const concern = page.locator('.rule-row', { hasText: 'Forward CancellationToken' });
	await expect(concern).toContainText('CA2016 (.NET analyzers), also MA0040');

	await concern.getByRole('button', { name: 'Turn off duplicates' }).click();

	await expect(concern).toHaveCount(0);
	await page.getByRole('link', { name: 'Review and export' }).first().click();
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_diagnostic.MA0040.severity = none');
});

test('banned APIs are exported as BannedSymbols.txt', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Banned API analyzers/ }).check();

	await page.getByRole('button', { name: 'Add: Clock access: use TimeProvider' }).click();
	await page.getByRole('link', { name: 'Review and export' }).first().click();

	await expect(page.getByTestId('file-BannedSymbols.txt')).toContainText('P:System.DateTime.UtcNow;Use TimeProvider.GetUtcNow() so time can be faked in tests.');
});

test('a CI-only build property lands in the CI builds group of Directory.Build.props', async ({ page }) => {
	await page.goto('/wizard/build');

	await page.getByRole('combobox', { name: 'TreatWarningsAsErrors', exact: true }).selectOption('true');
	await page.locator('.option-row', { hasText: 'TreatWarningsAsErrors' }).first().getByRole('checkbox', { name: 'CI builds only' }).check();

	await expect(page.getByTestId('file-Directory.Build.props')).toContainText(
		`<PropertyGroup Label="CI builds only" Condition="'$(ContinuousIntegrationBuild)' == 'true'"> <!-- Turns every compiler and analyzer warning into an error. --> <TreatWarningsAsErrors>true</TreatWarningsAsErrors>`
	);
});

test('central package management, nuget.config and global.json all download in the zip', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	await page.getByRole('link', { name: 'Packages', exact: true }).click();
	await page.getByRole('combobox', { name: 'ManagePackageVersionsCentrally', exact: true }).selectOption('true');
	await page.getByRole('checkbox', { name: 'Generate nuget.config' }).check();
	await page.getByRole('link', { name: 'SDK', exact: true }).click();
	await page.getByRole('checkbox', { name: 'Generate global.json' }).check();
	await page.getByRole('link', { name: 'Review and export' }).first().click();

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download zip' }).click();
	const files = unzipSync(await readFile(await (await downloadPromise).path()));

	expect(Object.keys(files).sort()).toEqual(['.editorconfig', '.gitattributes', 'Directory.Packages.props', 'global.json', 'nuget.config']);
	expect(strFromU8(files['Directory.Packages.props'])).toContain('<GlobalPackageReference Include="Meziantou.Analyzer"');
	expect(JSON.parse(strFromU8(files['global.json'])).sdk.rollForward).toBe('latestFeature');
});

test('the tests folder preset relaxes test-only rules and stops packing', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('button', { name: 'Add Test projects (tests)' }).click();

	await expect(page.getByTestId('file-tests/.editorconfig')).toContainText('dotnet_diagnostic.CA1707.severity = none');
	await expect(page.getByTestId('file-tests/Directory.Build.props')).toContainText('<IsPackable>false</IsPackable>');
});

test('a folder override shows what it inherits and only writes what it changes', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: 'Add Test projects (tests)' }).click();
	await page.getByRole('link', { name: 'Formatting' }).first().click();

	const indentStyle = page.getByRole('combobox', { name: 'All files: Indent style' });
	await expect(indentStyle.locator('option:checked')).toHaveText('Inherited (space)');
	await indentStyle.selectOption('tab');

	await expect(page.getByTestId('file-tests/.editorconfig')).toContainText('#### All files ####\n[*]\nindent_style = tab');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('indent_style = space');
});

test('a folder can drop an analyzer package its parent references', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	await page.getByRole('link', { name: 'Start' }).first().click();
	await page.getByRole('button', { name: 'Add Test projects (tests)' }).click();
	await page.getByRole('link', { name: 'Analyzers' }).first().click();

	await page.getByRole('checkbox', { name: 'Same packages as the folder above' }).uncheck();
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).uncheck();
	await page.getByRole('link', { name: 'Review and export' }).first().click();

	await expect(page.getByTestId('file-tests/Directory.Build.props')).toContainText('<PackageReference Remove="Meziantou.Analyzer" />');
});

test('a custom folder outside the repo is rejected', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('textbox', { name: 'New folder' }).fill('../shared');
	await page.getByRole('button', { name: 'Add folder' }).click();

	await expect(page.getByRole('alert')).toHaveText('The folder must be inside the repo.');
});

test('applying the Recommended preset fills in every file it needs', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('button', { name: /^Recommended/ }).click();

	await expect(page.getByRole('button', { name: /^Recommended/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_analyzer_diagnostic.category-Security.severity = error');
	await expect(page.getByTestId('file-Directory.Packages.props')).toContainText('<GlobalPackageReference Include="Meziantou.Analyzer"');
	await expect(page.getByTestId('file-tests/.editorconfig')).toContainText('dotnet_diagnostic.CA1707.severity = none');
	await expect(page.getByTestId('file-nuget.config')).toContainText('<clear />');
});

test('a risky combination shows as a check on the review step and a count in the nav', async ({ page }) => {
	await page.goto('/wizard/packages');
	await page.getByRole('combobox', { name: 'RestoreLockedMode', exact: true }).selectOption('true');

	await expect(page.getByRole('link', { name: /Review and export\s*1 problems/ })).toBeVisible();
	await page
		.getByRole('link', { name: /Review and export/ })
		.first()
		.click();

	await expect(page.locator('.issue-error')).toContainText('RestoreLockedMode needs RestorePackagesWithLockFile');
});

test('settings survive a reload', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Strict/ }).click();
	await expect(page.getByTestId('file-.editorconfig')).toContainText('category-Performance.severity = error');

	await page.reload();

	await expect(page.getByRole('button', { name: /^Strict/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('category-Performance.severity = error');
});

test('a share link reopens the same settings in a new browser', async ({ page, browser, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Library author/ }).click();
	await page.getByRole('link', { name: 'Formatting' }).first().click();
	await page.getByRole('combobox', { name: 'All files: Indent style' }).selectOption('tab');
	await page
		.getByRole('link', { name: /Review and export/ })
		.first()
		.click();
	await page.getByRole('button', { name: 'Copy share link' }).click();
	const shareUrl = await page.getByRole('textbox', { name: 'Share link' }).inputValue();

	const otherPage = await (await browser.newContext()).newPage();
	await otherPage.goto(shareUrl);

	await expect(otherPage.getByTestId('file-.editorconfig')).toContainText('indent_style = tab');
	await expect(otherPage.getByTestId('file-BannedSymbols.txt')).toContainText('T:System.Console;');
	expect(new URL(otherPage.url()).hash).toBe('');
});

test('a pasted .editorconfig imports its settings and reports what it dropped', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('textbox', { name: 'Pasted file contents' }).fill('[*.cs]\ndotnet_diagnostic.CA1822.severity = error # keep static\ndotnet_diagnostic.SA1101.severity = none');
	await page.getByRole('button', { name: 'Import pasted file' }).click();

	await expect(page.getByRole('list', { name: 'Import notes' })).toContainText('StyleCop.Analyzers is no longer maintained');
	await expect(page.getByRole('list', { name: 'Import notes' })).toContainText('Dropped 1 trailing comments');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_diagnostic.CA1822.severity = error');
});

test('importing a config from an older catalog offers the rules added since', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('textbox', { name: 'Pasted file contents' }).fill('# Settings for .NET SDK 10.0.4xx, catalog 2000-01-01\nroot = true');
	await page.getByRole('button', { name: 'Import pasted file' }).click();
	await page.getByRole('button', { name: 'Adopt CA1873' }).click();

	await expect(page.getByRole('heading', { name: "What's new since your config" })).toBeVisible();
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_diagnostic.CA1873.severity = warning');
});
