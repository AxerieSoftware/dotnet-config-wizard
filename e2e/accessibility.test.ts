import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES = [
	'/',
	'/wizard/start',
	'/wizard/formatting',
	'/wizard/code-style',
	'/wizard/naming',
	'/wizard/analyzers',
	'/wizard/build',
	'/wizard/packages',
	'/wizard/sdk',
	'/wizard/review',
	'/rules',
	'/rules/CA2007',
	'/options/csharp_style_namespace_declarations'
];

for (const path of PAGES) {
	test(`${path} has no serious accessibility problems`, async ({ page }) => {
		await page.goto(path);
		await page.waitForLoadState('networkidle');

		// axe counts an expanded folder's nested tree items as the folder's visible label, so every labeled folder in the file tree fails this rule
		const results = await new AxeBuilder({ page }).disableRules(['label-content-name-mismatch']).analyze();
		const serious = results.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');

		expect(serious.map(violation => `${violation.id}: ${violation.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
	});
}

test('the rule table can be reached and used from the keyboard', async ({ page }) => {
	await page.goto('/wizard/analyzers');
	await page.getByRole('textbox', { name: 'Search rules' }).fill('CA1822');

	await page.getByRole('textbox', { name: 'Search rules' }).focus();
	const severity = page.getByRole('combobox', { name: 'CA1822 severity' });
	for (let tabCount = 0; tabCount < 20 && !(await severity.evaluate(element => element === document.activeElement)); tabCount++) await page.keyboard.press('Tab');

	await expect(severity).toBeFocused();
	await expect(page.getByRole('table', { name: 'Rules' })).toHaveAttribute('aria-rowcount', '2');
});
