<script lang="ts">
import sdkCatalog from '../../catalog/generated/sdk-10.0.3xx.json';
import styleOptionCatalog from '../../catalog/generated/style-options.json';
</script>

<svelte:head>
	<title>.NET Config Wizard</title>
	<meta name="description" content="Generate .editorconfig, Directory.Build.props and analyzer settings for .NET repos.">
</svelte:head>

<main>
	<h1>.NET Config Wizard</h1>
	<p>Generate <code>.editorconfig</code>, <code>Directory.Build.props</code> and analyzer settings for .NET repos.</p>
	<p data-testid="catalog-summary">{sdkCatalog.rules.length} build-enforced rules from SDK {sdkCatalog.sdkVersion} and {styleOptionCatalog.options.length} code-style options.</p>
	<p>The wizard is under construction.</p>
</main>
