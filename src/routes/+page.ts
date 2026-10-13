import { redirect } from '@sveltejs/kit';

// The wizard is the front door; prerendering turns this into a redirect page.
export function load(): never {
	redirect(308, '/wizard/start');
}
