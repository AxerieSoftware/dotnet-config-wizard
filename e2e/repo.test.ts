import { expect, type Page, test } from '@playwright/test';
import { openStep } from './openStep.ts';

const REPO_FILES: Record<string, string> = {
	'.editorconfig': 'root = true\n\n[*]\nindent_style = space\n\n[*.cs]\nresharper_braces_for_ifelse = required\n',
	'Directory.Build.props': '<Project>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t\t<LangVersion>preview</LangVersion>\n\t</PropertyGroup>\n</Project>\n',
	'tests/.editorconfig': '[*.cs]\ndotnet_diagnostic.CA1707.severity = none\n',
	'src/App/Program.cs': 'Console.WriteLine("not config");\n'
};

const PROJECT_REPO_FILES: Record<string, string> = {
	'Directory.Build.props': '<Project>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>\n</Project>\n',
	'Directory.Packages.props': '<Project>\n\t<PropertyGroup>\n\t\t<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>\n\t</PropertyGroup>\n</Project>\n',
	'src/App/App.csproj':
		'<Project Sdk="Microsoft.NET.Sdk">\n\t<PropertyGroup>\n\t\t<TargetFramework>net10.0</TargetFramework>\n\t\t<OutputType>Exe</OutputType>\n\t\t<Nullable>enable</Nullable>\n\t\t<LangVersion>14</LangVersion>\n\t</PropertyGroup>\n\t<ItemGroup>\n\t\t<PackageReference Include="Serilog" Version="4.0.0" />\n\t</ItemGroup>\n</Project>\n'
};

const REPEATED_REPO_FILES: Record<string, string> = {
	'Directory.Build.props': '<Project>\n\t<PropertyGroup>\n\t\t<Deterministic>true</Deterministic>\n\t</PropertyGroup>\n</Project>\n',
	'src/Billing/Billing.csproj':
		'<Project Sdk="Microsoft.NET.Sdk">\n\t<PropertyGroup>\n\t\t<TargetFramework>net10.0</TargetFramework>\n\t\t<Nullable>enable</Nullable>\n\t</PropertyGroup>\n</Project>\n',
	'src/Shipping/Shipping.csproj':
		'<Project Sdk="Microsoft.NET.Sdk">\n\t<PropertyGroup>\n\t\t<TargetFramework>net10.0</TargetFramework>\n\t\t<Nullable>enable</Nullable>\n\t\t<OutputType>Exe</OutputType>\n\t</PropertyGroup>\n</Project>\n',
	'tests/Billing.Tests/Billing.Tests.csproj': '<Project Sdk="Microsoft.NET.Sdk">\n\t<PropertyGroup>\n\t\t<TargetFramework>net10.0</TargetFramework>\n\t</PropertyGroup>\n</Project>\n'
};

// Stands in for the folder picker with the browser's private file system, which has the same read and write API.
async function seedRepo(page: Page, repoFiles: Record<string, string> = REPO_FILES): Promise<void> {
	await page.addInitScript(files => {
		window.showDirectoryPicker = async () => {
			const root = await navigator.storage.getDirectory();
			await root.removeEntry('repo', { recursive: true }).catch(() => undefined);
			const repo = await root.getDirectoryHandle('repo', { create: true });
			for (const [path, text] of Object.entries(files)) {
				const segments = path.split('/');
				let folder = repo;
				for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true });
				const writable = await (await folder.getFileHandle(segments.at(-1) ?? path, { create: true })).createWritable();
				await writable.write(text);
				await writable.close();
			}
			return repo;
		};
	}, repoFiles);
}

function readRepoFile(page: Page, path: string): Promise<string> {
	return page.evaluate(async filePath => {
		const segments = filePath.split('/');
		let folder = await (await navigator.storage.getDirectory()).getDirectoryHandle('repo');
		for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment);
		return (await (await folder.getFileHandle(segments.at(-1) ?? filePath)).getFile()).text();
	}, path);
}

function isFolderRemembered(page: Page): Promise<boolean> {
	return page.evaluate(
		() =>
			new Promise<boolean>(resolve => {
				const opening = indexedDB.open('dotnet-config-wizard', 1);
				opening.onsuccess = () => {
					const reading = opening.result.transaction('folders', 'readonly').objectStore('folders').get('repo');
					reading.onsuccess = () => resolve(reading.result !== undefined);
				};
			})
	);
}

async function openSeededRepo(page: Page, repoFiles: Record<string, string>): Promise<void> {
	await seedRepo(page, repoFiles);
	await page.goto('/wizard/start');
	await page.getByRole('button', { name: /^In browser/ }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Choose folder' }).click();
	await expect(page.getByRole('button', { name: /^repo/ })).toContainText('Saved');
}

test('project file lines the generated files repeat are removed only once the user applies the ones they chose', async ({ page }) => {
	await openSeededRepo(page, PROJECT_REPO_FILES);
	await openStep(page, 'Review and export');

	const card = page.getByRole('region', { name: 'Project files' });
	const langVersion = card.getByRole('checkbox', { name: 'Remove <LangVersion>14</LangVersion> in src/App/App.csproj' });
	await expect(card.getByRole('group', { name: 'src/App/App.csproj' })).toContainText('Directory.Build.props sets Nullable to enable for this folder.');
	await langVersion.uncheck();
	expect(await readRepoFile(page, 'src/App/App.csproj')).toBe(PROJECT_REPO_FILES['src/App/App.csproj']);
	await card.getByRole('button', { name: 'Apply 2 changes' }).click();

	await expect(card.getByRole('status')).toHaveText('Updated 1 project file and Directory.Packages.props.');
	const project = await readRepoFile(page, 'src/App/App.csproj');
	expect(project).not.toContain('<Nullable>');
	expect(project).toContain('<PackageReference Include="Serilog" />');
	expect(project).toContain('<LangVersion>14</LangVersion>');
	expect(project).toContain('<OutputType>Exe</OutputType>');
	expect(await readRepoFile(page, 'Directory.Packages.props')).toContain('<PackageVersion Include="Serilog" Version="4.0.0" />');
	await expect(langVersion).not.toBeChecked();
});

test('an opened repo loads its config files and saves edits back without losing unmanaged settings', async ({ page }) => {
	await seedRepo(page);
	await page.goto('/wizard/start');

	await page.getByRole('button', { name: /^In browser/ }).click();
	await expect(page.getByRole('dialog', { name: 'Back up your repo first' })).toContainText('commit your work in git first');
	await page.getByRole('dialog').getByRole('button', { name: 'Choose folder' }).click();

	await expect(page.getByRole('button', { name: /^repo/ })).toContainText('Saved');
	await expect(page.getByRole('treeitem', { name: 'tests/', exact: true })).toBeVisible();
	await page.getByText(/notes about what was loaded/).click();
	await expect(page.getByRole('list', { name: 'Import notes' })).toContainText('resharper_braces_for_ifelse');

	await openStep(page, 'Formatting');
	await page.getByRole('combobox', { name: 'All files: Indent style' }).selectOption('tab');

	await expect.poll(() => readRepoFile(page, '.editorconfig')).toContain('indent_style = tab');
	const editorConfig = await readRepoFile(page, '.editorconfig');
	expect(editorConfig).toContain('resharper_braces_for_ifelse = required');
	expect(await readRepoFile(page, 'Directory.Build.props')).toBe(REPO_FILES['Directory.Build.props']);
	expect(await readRepoFile(page, 'src/App/Program.cs')).toBe(REPO_FILES['src/App/Program.cs']);
});

test('a setting every project in a folder repeats moves into a new props file there, and then out of the projects', async ({ page }) => {
	await openSeededRepo(page, REPEATED_REPO_FILES);
	await openStep(page, 'Review and export');

	const repeated = page.getByRole('region', { name: 'Repeated settings' });
	await expect(repeated).toContainText('<Nullable>enable</Nullable>');
	await expect(repeated).toContainText('In 2 projects under src/, which gets its own Directory.Build.props');
	await repeated.getByRole('listitem').filter({ hasText: '<Nullable>' }).getByRole('button', { name: 'Add src/ and set it' }).click();

	await expect.poll(() => readRepoFile(page, 'src/Directory.Build.props').catch(() => '')).toContain('<Nullable>enable</Nullable>');
	const projectFiles = page.getByRole('region', { name: 'Project files' });
	await expect(projectFiles.getByRole('checkbox', { name: 'Remove <Nullable>enable</Nullable> in src/Shipping/Shipping.csproj' })).toBeVisible();
	await projectFiles.getByRole('button', { name: 'Apply 2 changes' }).click();

	await expect(projectFiles.getByRole('status')).toHaveText('Updated 2 project files.');
	expect(await readRepoFile(page, 'src/Billing/Billing.csproj')).not.toContain('<Nullable>');
	expect(await readRepoFile(page, 'src/Shipping/Shipping.csproj')).toContain('<OutputType>Exe</OutputType>');
});

test('the folder opened last can be reopened after a reload, and is forgotten when it is closed', async ({ page }) => {
	await openSeededRepo(page, REPO_FILES);
	await page.reload();

	const repoButton = page.getByRole('button', { name: /^repo/ });
	await expect(repoButton).toContainText('Reopen');
	await repoButton.click();
	await page.getByRole('menuitem', { name: 'Reopen repo' }).click();
	await page.getByRole('dialog', { name: 'Reopen repo?' }).getByRole('button', { name: 'Reopen' }).click();

	await expect(repoButton).toContainText('Saved');
	await expect(page.getByRole('treeitem', { name: 'tests/', exact: true })).toBeVisible();
	await repoButton.click();
	await page.getByRole('menuitem', { name: 'Close folder' }).click();
	await expect(page.getByRole('button', { name: /^In browser/ })).toBeVisible();
	await expect.poll(() => isFolderRemembered(page)).toBe(false);
	await page.reload();
	await expect(page.getByRole('button', { name: /^In browser/ })).toBeVisible();
});

test('choosing a comment style while a repo is open writes its comments into the files it rewrites, and only those', async ({ page }) => {
	await openSeededRepo(page, {
		'.editorconfig': 'root = true\n\n[*.cs]\ndotnet_diagnostic.CA1822.severity = warning\n',
		'Directory.Build.props': '<Project>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t\t<Deterministic>true</Deterministic>\n\t</PropertyGroup>\n</Project>\n'
	});
	await openStep(page, 'Review and export');

	await page.getByRole('combobox', { name: 'Rule comments' }).selectOption('titleAndLink');
	await expect.poll(() => readRepoFile(page, '.editorconfig')).toContain('Mark members as static');
	await openStep(page, 'Build');
	await page.getByRole('combobox', { name: 'Nullable', exact: true }).selectOption('disable');

	await expect.poll(() => readRepoFile(page, 'Directory.Build.props')).toContain('<Nullable>disable</Nullable>');
	expect((await readRepoFile(page, 'Directory.Build.props')).match(/<!--/g)).toHaveLength(1);
});

test('an edit undone before it saves writes nothing', async ({ page }) => {
	await openSeededRepo(page, REPO_FILES);
	await openStep(page, 'Formatting');
	const indentStyle = page.getByRole('combobox', { name: 'All files: Indent style' });

	await indentStyle.selectOption('tab');
	await indentStyle.selectOption('space');

	await expect(page.getByRole('button', { name: /^repo/ })).toContainText('Saved');
	await page.waitForTimeout(1000);
	expect(await readRepoFile(page, '.editorconfig')).toBe(REPO_FILES['.editorconfig']);
});
