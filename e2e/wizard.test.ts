import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { openStep } from './openStep.ts';

/** Picks an item from the repo root's right-click menu in the file tree. */
async function chooseFromRootMenu(page: Page, item: string): Promise<void> {
	await page
		.getByRole('treeitem', { name: /^Repo root/ })
		.locator('.tree-row')
		.first()
		.click({ button: 'right' });
	await page.getByRole('menuitem', { name: item }).click();
}

/** Adds a common folder, such as `tests`, through the tree's menu and the Add folder dialog. */
async function addFolder(page: Page, path: string): Promise<void> {
	await chooseFromRootMenu(page, 'Add a folder');
	await page
		.getByRole('dialog', { name: 'Add a folder' })
		.getByRole('button', { name: new RegExp(`^${path}/`) })
		.click();
}

async function chooseImportFile(page: Page, editorConfig: string): Promise<void> {
	await page.getByLabel('Choose files').setInputFiles({ name: '.editorconfig', mimeType: 'text/plain', buffer: Buffer.from(editorConfig) });
}

function editingBar(page: Page) {
	return page.getByRole('status').filter({ hasText: /\bEditing\b/ });
}

test('a formatting choice shows in the live preview', async ({ page }) => {
	await page.goto('/wizard/formatting');

	await page.getByRole('combobox', { name: 'C# files: Indent style' }).selectOption('tab');

	await expect(page.getByTestId('file-.editorconfig')).toContainText('#### C# files ####\n[*.cs]\nindent_style = tab');
});

test('code-style choices carry through to the downloaded zip', async ({ page }) => {
	await page.goto('/');
	await openStep(page, 'Start');
	await openStep(page, 'Code style');

	await page.getByRole('combobox', { name: 'dotnet_style_qualification_for_field', exact: true }).selectOption('true');
	await page.getByRole('combobox', { name: 'IDE0009 severity' }).selectOption('warning');
	await openStep(page, 'Review and export');

	const reviewFile = page.getByTestId('file-.editorconfig');
	await expect(reviewFile).toContainText('## this. and Me. qualification (IDE0003, IDE0009)\ndotnet_style_qualification_for_field = true');
	await expect(reviewFile).toContainText('# IDE0009: Member access should be qualified\ndotnet_diagnostic.IDE0009.severity = warning');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download zip' }).click();
	const download = await downloadPromise;
	const files = unzipSync(await readFile(await download.path()));

	expect(download.suggestedFilename()).toBe('dotnet-config.zip');
	expect(Object.keys(files)).toEqual(['.editorconfig', '.gitattributes', 'DOTNET-CONFIG.md']);
	expect(strFromU8(files['.editorconfig'])).toBe(await reviewFile.textContent());
});

test('an unset rule shows the severity it runs at by default', async ({ page }) => {
	await page.goto('/wizard/code-style');

	await expect(page.getByRole('combobox', { name: 'IDE0036 severity' }).locator('option:checked')).toHaveText('Default (silent)');
});

test('rules the build never runs are labeled editor only', async ({ page }) => {
	await page.goto('/wizard/code-style');

	await expect(page.locator('.rule-row', { hasText: 'IDE0003' }).getByText('Editor only')).toBeVisible();
});

test('a rule that needs a newer C# than the target framework is hidden until asked', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('combobox', { name: 'SDK band' }).selectOption('11.0.1xx');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('# Settings for .NET SDK 11.0.1xx');
	await page.goto('/wizard/build');
	await page.getByRole('checkbox', { name: 'net11.0' }).uncheck();
	await page.getByRole('checkbox', { name: 'net10.0' }).check();
	await expect(page.getByTestId('effective-csharp')).toContainText('Compiles as C# 14.0');
	await openStep(page, 'Code style');
	// The collapsed sidebar stays open over the page while the mouse is on it.

	await expect(page.getByRole('combobox', { name: 'IDE0410 severity' })).toHaveCount(0);

	await page.getByRole('checkbox', { name: /Show options and rules/ }).check();

	await expect(page.getByRole('combobox', { name: 'IDE0410 severity' })).toBeDisabled();
	await expect(page.locator('.rule-row', { hasText: 'IDE0410' }).getByText('Needs C# 15.0')).toBeVisible();
});

test('switching the SDK moves the default target framework with it', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('combobox', { name: 'SDK band' }).selectOption('11.0.1xx');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('# Settings for .NET SDK 11.0.1xx');
	await page.goto('/wizard/build');

	await expect(page.getByRole('checkbox', { name: 'net11.0' })).toBeChecked();
	await expect(page.getByRole('checkbox', { name: 'net10.0' })).not.toBeChecked();
	await expect(page.getByTestId('effective-csharp')).toContainText('Compiles as C# 15.0');
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
	await openStep(page, 'Review and export');

	await expect(page.getByTestId('file-.editorconfig')).toContainText('## Meziantou.Analyzer: Usage\n# MA0004: Use Task.ConfigureAwait\ndotnet_diagnostic.MA0004.severity = error');
});

test('turning off duplicates leaves one active rule per concern', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	const concern = page.locator('.rule-row', { hasText: 'Forward CancellationToken' });
	await expect(concern).toContainText('CA2016 (.NET analyzers), also MA0040');

	await concern.getByRole('button', { name: 'Turn off duplicates' }).click();

	await expect(concern).toHaveCount(0);
	await openStep(page, 'Review and export');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_diagnostic.MA0040.severity = none');
});

test('banned APIs are exported as BannedSymbols.txt', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Banned API analyzers/ }).check();

	await page.getByRole('button', { name: 'Add: Clock access: use TimeProvider' }).click();
	await openStep(page, 'Review and export');

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
	await openStep(page, 'Packages');
	await page.getByRole('combobox', { name: 'ManagePackageVersionsCentrally', exact: true }).selectOption('true');
	await page.getByRole('checkbox', { name: 'Generate nuget.config' }).check();
	await openStep(page, 'SDK');
	await page.getByRole('checkbox', { name: 'Generate global.json' }).check();
	await openStep(page, 'Review and export');

	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Download zip' }).click();
	const files = unzipSync(await readFile(await (await downloadPromise).path()));

	expect(Object.keys(files).sort()).toEqual(['.editorconfig', '.gitattributes', 'DOTNET-CONFIG.md', 'Directory.Packages.props', 'global.json', 'nuget.config']);
	expect(strFromU8(files['DOTNET-CONFIG.md'])).toContain('move each `Version` from your projects');
	expect(strFromU8(files['Directory.Packages.props'])).toContain('<GlobalPackageReference Include="Meziantou.Analyzer"');
	expect(JSON.parse(strFromU8(files['global.json'])).sdk.rollForward).toBe('latestFeature');
});

test('the tests folder preset relaxes test-only rules and stops packing', async ({ page }) => {
	await page.goto('/wizard/start');

	await addFolder(page, 'tests');

	await expect(page.getByTestId('file-tests/.editorconfig')).toContainText('dotnet_diagnostic.CA1707.severity = none');
	await expect(page.getByTestId('file-tests/Directory.Build.props')).toContainText('<IsPackable>false</IsPackable>');
});

test('a folder override shows what it inherits and only writes what it changes', async ({ page }) => {
	await page.goto('/wizard/start');
	await addFolder(page, 'tests');
	await openStep(page, 'Formatting');

	const indentStyle = page.getByRole('combobox', { name: 'All files: Indent style' });
	await expect(indentStyle.locator('option:checked')).toHaveText('Inherited (space)');
	await indentStyle.selectOption('tab');

	await expect(page.getByRole('combobox', { name: 'Markdown: Indent style' }).locator('option:checked')).toHaveText('From [*] (tab)');
	await expect(page.getByRole('region', { name: 'All files' })).toContainText('Tabs: keep indent size and tab width equal');
	await expect(page.getByRole('region', { name: 'Markdown' })).not.toContainText('Tabs:');
	await expect(page.getByTestId('file-tests/.editorconfig')).toContainText('#### All files ####\n[*]\nindent_style = tab');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('indent_style = space');
});

test('settings that differ from what the folder inherits are highlighted', async ({ page }) => {
	await page.goto('/wizard/start');
	await addFolder(page, 'tests');
	await openStep(page, 'Formatting');

	const indentStyle = page.getByRole('combobox', { name: 'All files: Indent style' });
	await expect(indentStyle).not.toHaveClass(/\bchanged\b/);
	await indentStyle.selectOption('space');
	await expect(indentStyle).not.toHaveClass(/\bchanged\b/);
	await indentStyle.selectOption('tab');
	await expect(indentStyle).toHaveClass(/\bchanged\b/);
});

test('a folder can drop an analyzer package its parent references', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	await openStep(page, 'Start');
	await addFolder(page, 'tests');
	await openStep(page, 'Analyzers');

	await page.getByRole('checkbox', { name: 'Same packages as the folder above' }).uncheck();
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).uncheck();
	await openStep(page, 'Review and export');

	await expect(page.getByTestId('file-tests/Directory.Build.props')).toContainText('<PackageReference Remove="Meziantou.Analyzer" />');
});

test('a custom folder outside the repo is rejected', async ({ page }) => {
	await page.goto('/wizard/start');
	await chooseFromRootMenu(page, 'Add a folder');

	const dialog = page.getByRole('dialog', { name: 'Add a folder' });
	await dialog.getByRole('textbox', { name: 'New folder' }).fill('../shared');
	await dialog.getByRole('button', { name: 'Add folder' }).click();

	await expect(dialog.getByRole('alert')).toHaveText('The folder must be inside the repo.');
});

test('applying the Recommended preset fills in every file it needs', async ({ page }) => {
	await page.goto('/wizard/start');

	await page.getByRole('button', { name: /^Recommended/ }).click();

	await expect(page.getByRole('button', { name: /^Recommended/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_analyzer_diagnostic.category-Security.severity = error');
	await expect(page.getByTestId('file-Directory.Packages.props')).toContainText('<GlobalPackageReference Include="Microsoft.VisualStudio.Threading.Analyzers"');
	await expect(page.getByTestId('file-tests/.editorconfig')).toContainText('dotnet_diagnostic.CA1707.severity = none');
	await expect(page.getByTestId('file-nuget.config')).toContainText('<clear />');
});

test('a risky combination shows as a check on the review step and a count in the nav', async ({ page }) => {
	await page.goto('/wizard/packages');
	await page.getByRole('combobox', { name: 'RestoreLockedMode', exact: true }).selectOption('true');

	await expect(page.getByRole('link', { name: /Review and export\s*1 problems/ })).toBeVisible();
	await openStep(page, 'Review and export');

	await expect(page.locator('.issue-error')).toContainText('RestoreLockedMode needs RestorePackagesWithLockFile');
});

test('Strict for libraries combines a strictness with a project kind', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Strict/ }).click();
	await page.getByRole('button', { name: /^Libraries/ }).click();

	await expect(page.getByRole('button', { name: /^Strict/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: /^Libraries/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('file-Directory.Packages.props')).toContainText('Include="SonarAnalyzer.CSharp"');
	await expect(page.getByTestId('file-src/Directory.Packages.props')).toContainText('Include="Microsoft.CodeAnalysis.PublicApiAnalyzers"');
});

test('a category severity writes one line and duplicates turn off in one click', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('combobox', { name: 'Performance category severity' }).selectOption('error');
	await page.getByRole('checkbox', { name: /SonarAnalyzer\.CSharp/ }).check();
	await page.getByRole('checkbox', { name: /Meziantou\.Analyzer/ }).check();
	await page.getByRole('button', { name: 'Turn off all duplicates' }).click();

	await expect(page.getByRole('heading', { name: 'Duplicate rules' })).toHaveCount(0);
	await openStep(page, 'Review and export');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_analyzer_diagnostic.category-Performance.severity = error');
	await expect(page.getByTestId('no-issues')).toBeVisible();
});

test("a folder's file shows the settings it really gets, with its own overrides marked", async ({ page }) => {
	await page.goto('/wizard/start');
	await addFolder(page, 'tests');

	await expect(page.locator('.viewer-path')).toHaveText('tests/.editorconfig');
	await page.getByRole('button', { name: 'Effective', exact: true }).click();

	const effective = page.getByTestId('effective-.editorconfig');
	await expect(effective).toContainText('end_of_line = lf');
	await expect(effective).toContainText('dotnet_diagnostic.CA1707.severity = none');
	await expect(effective.locator('.line.own', { hasText: 'dotnet_diagnostic.CA1707.severity = none' })).toHaveCount(1);
});

test('each folder step says which folder it edits, and adding a folder switches to it', async ({ page }) => {
	await page.goto('/wizard/formatting');
	await expect(editingBar(page)).toContainText('repo root');

	await chooseFromRootMenu(page, 'Add a folder');
	await page
		.getByRole('dialog', { name: 'Add a folder' })
		.getByRole('button', { name: /^samples\// })
		.click();

	await expect(editingBar(page)).toContainText('samples/');
	await expect(page.getByTestId('file-samples/Directory.Build.props')).toContainText('<IsPackable>false</IsPackable>');
});

test('the preview resizes from the keyboard and keeps its width', async ({ page }) => {
	await page.goto('/wizard/formatting');
	const resizer = page.getByRole('separator', { name: 'Resize preview' });

	await expect(resizer).toHaveAttribute('aria-valuetext', 'Half the page');
	const evenWidth = await page.getByRole('complementary', { name: 'Preview' }).evaluate(element => element.getBoundingClientRect().width);

	await resizer.focus();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await page.reload();

	await expect(page.getByRole('separator', { name: 'Resize preview' })).toHaveAttribute('aria-valuenow', String(Math.round(evenWidth + 64)));
});

test('the file tree resizes on its own and keeps its width', async ({ page }) => {
	await page.goto('/wizard/formatting');
	const tree = page.locator('.tree-pane');

	await page.getByRole('separator', { name: 'Resize file tree' }).focus();
	await page.keyboard.press('ArrowLeft');
	await page.reload();

	await expect(page.getByRole('separator', { name: 'Resize file tree' })).toHaveAttribute('aria-valuenow', '232');
	expect(await tree.evaluate(element => element.getBoundingClientRect().width)).toBe(232);
	await expect(page.getByRole('separator', { name: 'Resize preview' })).toHaveAttribute('aria-valuetext', 'Half the page');
});

test('hovering a line explains it and clicking it opens its setting', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Recommended/ }).click();
	const line = page.getByTestId('file-.editorconfig').locator('.line', { hasText: 'csharp_style_namespace_declarations = file_scoped' });

	await line.hover();
	await expect(page.getByRole('tooltip')).toContainText('block_scoped');

	await line.click();
	await expect(page).toHaveURL(/\/wizard\/code-style$/);
	await expect(page.getByRole('combobox', { name: 'csharp_style_namespace_declarations', exact: true })).toBeFocused();
});

test('clicking a rule line filters the rule table to it and focuses its severity', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Recommended/ }).click();

	await page.getByTestId('file-.editorconfig').locator('.line', { hasText: 'dotnet_diagnostic.CA1848.severity = warning' }).click();

	await expect(page).toHaveURL(/\/wizard\/analyzers$/);
	await expect(page.getByRole('textbox', { name: 'Search rules' })).toHaveValue('CA1848');
	await expect(page.getByRole('combobox', { name: 'CA1848 severity' })).toBeFocused();
});

test('opening a folder in the file tree makes it the folder being edited', async ({ page }) => {
	await page.goto('/wizard/start');
	await addFolder(page, 'tests');
	await openStep(page, 'Formatting');
	await page.getByRole('treeitem', { name: 'Repo root' }).locator('.tree-row').first().click();
	await expect(editingBar(page)).toContainText('repo root');

	await page.getByRole('treeitem', { name: 'tests/.editorconfig' }).click();

	await expect(editingBar(page)).toContainText('tests/');
	await expect(page.getByTestId('file-tests/.editorconfig')).toBeVisible();
});

test('settings survive a reload', async ({ page }) => {
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Strict/ }).click();
	await expect(page.getByTestId('file-.editorconfig')).toContainText('category-Performance.severity = error');

	await page.reload();

	await expect(page.getByRole('button', { name: /^Strict/ })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('category-Performance.severity = error');
});

test('an ignored folder has analyzers skip its code until it is no longer ignored', async ({ page }) => {
	await page.goto('/wizard/start');
	await chooseFromRootMenu(page, 'Add a folder');
	const dialog = page.getByRole('dialog', { name: 'Add a folder' });
	await dialog.getByRole('textbox', { name: 'New folder' }).fill('legacy');
	await dialog.getByRole('checkbox', { name: /Ignore its code/ }).check();
	await dialog.getByRole('button', { name: 'Add folder' }).click();

	await expect(page.getByTestId('file-legacy/.editorconfig')).toContainText('generated_code = true');
	await expect(page.getByTestId('file-legacy/Directory.Build.props')).toContainText('<TreatWarningsAsErrors>false</TreatWarningsAsErrors>');
	await expect(page.getByRole('treeitem', { name: /^legacy\/(, editing)?$/ })).toContainText('ignored');

	await page
		.getByRole('treeitem', { name: /^legacy\/(, editing)?$/ })
		.locator('.tree-row')
		.first()
		.click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Stop ignoring code in this folder' }).click();

	await expect(page.getByTestId('file-legacy/.editorconfig')).toHaveCount(0);
});

test('editing a setting opens the file it writes and highlights its line', async ({ page }) => {
	await page.goto('/wizard/build');
	await page.getByRole('combobox', { name: 'Nullable', exact: true }).selectOption('enable');

	await expect(page.locator('.viewer-path')).toHaveText('Directory.Build.props');
	await expect(page.locator('.line.linked')).toHaveText('<Nullable>enable</Nullable>');
});

test('a single framework can be set for every project from shared props', async ({ page }) => {
	await page.goto('/wizard/build');
	await page.getByRole('checkbox', { name: 'Set the target frameworks for every project here' }).check();

	await expect(page.getByTestId('file-Directory.Build.props')).toContainText('<TargetFramework>net');
	await expect(page.locator('.line.linked')).toContainText('<TargetFramework>net');
});

test('letting tests use internal types adds the .Tests InternalsVisibleTo item', async ({ page }) => {
	await page.goto('/wizard/build');
	await page.getByRole('checkbox', { name: 'Let tests use internal types' }).check();

	await expect(page.getByTestId('file-Directory.Build.props')).toContainText('<InternalsVisibleTo Include="$(AssemblyName).Tests" />');
	await expect(page.locator('.line.linked')).toContainText('InternalsVisibleTo');
});

test("a tests folder can reference each test project's project under test", async ({ page }) => {
	await page.goto('/wizard/start');
	await addFolder(page, 'tests');
	await openStep(page, 'Build');
	await page.getByRole('checkbox', { name: 'Reference the project under test' }).check();

	await expect(page.getByTestId('file-tests/Directory.Build.props')).toContainText('<ProjectReference Include="$(ProjectUnderTestPath)"');
	await expect(page.getByTestId('file-tests/Directory.Build.props')).toContainText('$(MSBuildThisFileDirectory)../src/$(ProjectUnderTest)/$(ProjectUnderTest).csproj');
	await expect(page.locator('.line.linked')).toContainText('<ProjectUnderTest>');

	await page.getByRole('combobox', { name: 'Project kind' }).selectOption('library');
	// Outside a test folder the checkbox stays while the setting is on, and goes once it's turned off.
	await page.getByRole('checkbox', { name: 'Reference the project under test' }).click();

	await expect(page.getByTestId('file-tests/Directory.Build.props')).not.toContainText('ProjectUnderTestPath');
	await expect(page.getByRole('checkbox', { name: 'Reference the project under test' })).toHaveCount(0);
});

test('a project name prefix names every project and its tests', async ({ page }) => {
	await page.goto('/wizard/build');
	await page.getByRole('textbox', { name: 'Project name prefix' }).fill('Contoso');
	await page.getByRole('textbox', { name: 'Project name prefix' }).press('Tab');

	await expect(page.getByTestId('file-Directory.Build.props')).toContainText('<AssemblyName>Contoso.$(MSBuildProjectName)</AssemblyName>');
	await expect(page.getByTestId('file-Directory.Build.props')).toContainText('<RootNamespace>Contoso.$(MSBuildProjectName)</RootNamespace>');
	await expect(page.getByTestId('file-Directory.Build.props')).toContainText(`Condition="'$(MSBuildProjectName)' != 'Contoso' and !$(MSBuildProjectName.StartsWith('Contoso.'))"`);
});

test('the project name prefix field trims surrounding spaces and trailing dots on blur', async ({ page }) => {
	await page.goto('/wizard/build');
	const prefix = page.getByRole('textbox', { name: 'Project name prefix' });
	await prefix.fill('Contoso');
	await prefix.press('Tab');
	await prefix.fill(' Contoso. ');
	await prefix.press('Tab');

	await expect(prefix).toHaveValue('Contoso');
});

test('the folder being edited survives a reload', async ({ page }) => {
	await page.goto('/wizard/start');
	await addFolder(page, 'tests');
	await openStep(page, 'Formatting');
	await expect(page).toHaveURL(/\/wizard\/formatting$/);

	await page.reload();

	await expect(editingBar(page)).toContainText('tests/');
});

test('nothing is saved until a setting changes, then the header says it is saved', async ({ page }) => {
	await page.goto('/wizard/formatting');
	const repoButton = page.getByRole('button', { name: /^In browser/ });

	await expect(repoButton).toContainText('Open folder');
	await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);
	expect(await page.evaluate(() => localStorage.getItem('dotnet-config-wizard'))).toBeNull();

	await page.getByRole('combobox', { name: 'All files: Indent style' }).selectOption('tab');
	await page.reload();

	await expect(repoButton).toContainText('Saved');
	await page.getByRole('button', { name: 'Start over' }).click();
	await page.getByRole('dialog', { name: 'Start over?' }).getByRole('button', { name: 'Start over' }).click();

	await expect(page).toHaveURL(/\/wizard\/start$/);
	await expect(repoButton).toContainText('Open folder');
	await expect(page.getByRole('button', { name: 'Start over' })).toHaveCount(0);
	await expect(page.getByTestId('file-.editorconfig')).not.toContainText('indent_style = tab');
	expect(await page.evaluate(() => localStorage.getItem('dotnet-config-wizard'))).toBeNull();
});

test('applying a preset over changes asks first, and Cancel keeps the changes', async ({ page }) => {
	await page.goto('/wizard/formatting');
	await page.getByRole('combobox', { name: 'All files: Indent style' }).selectOption('tab');
	await openStep(page, 'Start');

	await page.getByRole('button', { name: /^Strict/ }).click();
	await expect(page.getByRole('dialog', { name: 'Replace your settings?' })).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Strict/ })).toHaveAttribute('aria-pressed', 'false');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('indent_style = tab');
});

test('a share link reopens the same settings in a new browser', async ({ page, browser, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^Recommended/ }).click();
	await page.getByRole('button', { name: /^Libraries/ }).click();
	await openStep(page, 'Formatting');
	await page.getByRole('combobox', { name: 'All files: Indent style' }).selectOption('tab');
	await openStep(page, 'Review and export');
	await page.getByRole('button', { name: 'Copy share link' }).click();
	await expect(page.getByRole('button', { name: 'Copied to clipboard' })).toBeVisible();
	const shareUrl = await page.evaluate(() => navigator.clipboard.readText());

	const otherPage = await (await browser.newContext()).newPage();
	await otherPage.goto(shareUrl);

	await expect(otherPage.getByTestId('file-.editorconfig')).toContainText('indent_style = tab');
	await expect(otherPage.getByTestId('file-src/BannedSymbols.txt')).toContainText('T:System.Console;');
	expect(new URL(otherPage.url()).hash).toBe('');
	await expect(otherPage.getByText('Opened settings from a share link.')).toBeVisible();
});

test('an imported .editorconfig brings in its settings and reports what it dropped', async ({ page }) => {
	await page.goto('/wizard/start');
	await chooseFromRootMenu(page, 'Import files into this folder');

	await chooseImportFile(page, '[*.cs]\ndotnet_diagnostic.CA1822.severity = error # keep static\ndotnet_diagnostic.SA1101.severity = none');

	await expect(page.getByRole('list', { name: 'Import notes' })).toContainText('StyleCop.Analyzers is no longer maintained');
	await expect(page.getByRole('list', { name: 'Import notes' })).toContainText('Dropped 1 trailing comments');
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_diagnostic.CA1822.severity = error');
});

test('importing a config from an older catalog offers the rules added since', async ({ page }) => {
	await page.goto('/wizard/start');
	await chooseFromRootMenu(page, 'Import files into this folder');

	await chooseImportFile(page, '# Settings for .NET SDK 10.0.4xx, catalog 2000-01-01\nroot = true');
	await page.getByRole('button', { name: 'Adopt CA1873' }).click();

	await expect(page.getByRole('heading', { name: "What's new since your config" })).toBeVisible();
	await expect(page.getByTestId('file-.editorconfig')).toContainText('dotnet_diagnostic.CA1873.severity = warning');
});
