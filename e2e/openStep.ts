import type { Page } from '@playwright/test';

/** Opens a wizard step from the sidebar, then moves the pointer off it so the rail, which opens on hover, doesn't cover the page. */
export async function openStep(page: Page, title: string): Promise<void> {
	await page
		.getByRole('navigation', { name: 'Wizard steps' })
		.getByRole('link', { name: new RegExp(`^${title}`) })
		.click();
	await page.mouse.move(900, 400);
}
