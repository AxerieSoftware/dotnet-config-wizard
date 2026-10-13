import { expect, type Page, test } from '@playwright/test';

const REPO_FILES: Record<string, string> = {
	'.editorconfig': 'root = true\n\n[*]\nindent_style = space\n\n[*.cs]\nresharper_braces_for_ifelse = required\n',
	'Directory.Build.props': '<Project>\n\t<PropertyGroup>\n\t\t<Nullable>enable</Nullable>\n\t\t<LangVersion>preview</LangVersion>\n\t</PropertyGroup>\n</Project>\n',
	'tests/.editorconfig': '[*.cs]\ndotnet_diagnostic.CA1707.severity = none\n',
	'src/App/Program.cs': 'Console.WriteLine("not config");\n'
};

// Stands in for the folder picker with the browser's private file system, which has the same read and write API.
async function seedRepo(page: Page): Promise<void> {
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
	}, REPO_FILES);
}

function readRepoFile(page: Page, path: string): Promise<string> {
	return page.evaluate(async filePath => {
		const segments = filePath.split('/');
		let folder = await (await navigator.storage.getDirectory()).getDirectoryHandle('repo');
		for (const segment of segments.slice(0, -1)) folder = await folder.getDirectoryHandle(segment);
		return (await (await folder.getFileHandle(segments.at(-1) ?? filePath)).getFile()).text();
	}, path);
}

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

	await page.getByRole('navigation', { name: 'Wizard steps' }).getByRole('link', { name: 'Formatting' }).click();
	await page.getByRole('combobox', { name: 'All files: Indent style' }).selectOption('tab');

	await expect.poll(() => readRepoFile(page, '.editorconfig')).toContain('indent_style = tab');
	const editorConfig = await readRepoFile(page, '.editorconfig');
	expect(editorConfig).toContain('resharper_braces_for_ifelse = required');
	expect(await readRepoFile(page, 'Directory.Build.props')).toBe(REPO_FILES['Directory.Build.props']);
	expect(await readRepoFile(page, 'src/App/Program.cs')).toBe(REPO_FILES['src/App/Program.cs']);
});
