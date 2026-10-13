<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';

	const SITE_LINKS = [
		{ href: '/wizard/start', section: '/wizard', title: 'Wizard' },
		{ href: '/rules', section: '/rules', title: 'Rules' },
		{ href: '/options', section: '/options', title: 'Options' }
	];

	let { actions }: { actions?: Snippet } = $props();
</script>

<header class="app-header">
	<a class="app-title" href="/wizard/start"><img src={favicon} alt=""><span>.NET Config Wizard</span></a>
	<nav class="site-nav" aria-label="Site">
		{#each SITE_LINKS as link (link.href)}
			<a href={link.href} aria-current={page.url.pathname.startsWith(link.section) ? 'page' : undefined}>{link.title}</a>
		{/each}
	</nav>
	{#if actions}
		<div class="header-actions">{@render actions()}</div>
	{/if}
</header>
