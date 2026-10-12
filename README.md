# .NET Config Wizard

A client-side wizard at [dotnetconfig.axerie.com](https://dotnetconfig.axerie.com) that generates `.editorconfig`, `Directory.Build.props`, `Directory.Packages.props`, `global.json` and analyzer configuration for .NET repos, with separate settings for `src/`, `tests/` and other folders.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server. |
| `npm run check` | Typecheck, lint, find unused code and run unit tests. |
| `npm run e2e` | Build the site and run the Playwright tests. |
| `npm run build` | Build the static site into `build/`. |
| `npm run catalog` | Regenerate `catalog/generated` from the latest SDK of every supported .NET 10+ channel and dotnet/docs. SDKs install into `.cache/dotnet`. |
| `node scripts/renderConfig.ts config/dogfood.json` | Regenerate this repo's `.editorconfig` from its wizard config. Add `--check` to compare instead of write. |
| `node scripts/validateOutput.ts` | Build the sample projects in `validation/` with generated config on every cataloged SDK, failing on config breakage. |
| `dotnet test --solution dotnet-config-wizard.slnx` | Test CatalogBuilder. |

## Layout

- `src/` — the SvelteKit app, organized by wizard feature under `src/lib/`.
- `catalog/generated/` — rule and option data written by CatalogBuilder. Don't edit by hand.
- `tools/CatalogBuilder/` — .NET tool that reads analyzers from an installed SDK and options from dotnet/docs.
- `config/dogfood.json` — the wizard config this repo's own `.editorconfig` is generated from.
- `validation/` — sample projects that CI builds with generated config.
- `scripts/` — Node scripts that render configs and validate output, sharing the generators in `src/lib`.
- `e2e/` — Playwright tests.

Rule and option descriptions come from [dotnet/docs](https://github.com/dotnet/docs), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
