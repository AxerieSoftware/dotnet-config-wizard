# Agent guide

How to work in this repo. [README.md](README.md) covers what the app does and the commands; [docs/catalog.md](docs/catalog.md) covers where rule and option data comes from.

## Every change

Before calling a change done, review the diff against this guide and clean it up:

- `npm run check` passes (typecheck, lint, knip, unit tests).
- `npm run e2e` passes, with new behavior covered by an end-to-end test.
- `dotnet test --solution dotnet-config-wizard.slnx` passes when anything under `tools/` changed.
- `npm run catalog` runs cleanly when CatalogBuilder or the catalog format changed, and the regenerated `catalog/generated` is committed.
- `node scripts/validateOutput.ts` passes when a generator or the catalog changed.
- `node scripts/renderConfig.ts config/dogfood.json --check` passes. Change this repo's `.editorconfig`, `Directory.Build.props`, `Directory.Packages.props` or `.gitattributes` by editing `config/dogfood.json` and rerendering, never by hand.
- Code in `src/lib` that scripts import stays plain TypeScript Node can run: `.ts` import extensions, and no parameter properties or enums.

## Code

Follow [docs/code-style.md](docs/code-style.md). In short:

- **Self-documenting first.** Descriptive names, no abbreviations. If code needs a comment to explain what it does, rename or restructure first.
- **Comments** say why, not what. Never restate the code, narrate a change or mention earlier iterations.
- **Vertical slices.** Each wizard feature keeps its model, generator, validation and components together under `src/lib/<feature>/`.
- **Generators are plain functions** from the config model to file text. No plugin systems or generic generator abstractions.
- **No over-implementation.** Handle what users can hit. No speculative options, guards or abstractions. This limits app code and UI toggles, not the catalog: every cataloged rule and option stays configurable.
- **US English** in UI copy, comments and docs.
- **Greenfield.** No compatibility shims or leftovers from earlier iterations. The one exception is reading older saved state and headers: version 1 share links and `.editorconfig` headers named what src held (`Strict for libraries`), and `toPresetConfigWithSource` rebuilds those presets.

## Presets and saved state

- Share links and autosaved state are `{schemaVersion, sdkBand, preset, changes}`: the preset name plus only what differs from it. Changing a preset's output changes what old links mean, with no notice.
- A preset is a strictness level. What a folder holds (library, app or tests) is set on the folder, and `toFolderDefaults` in `src/lib/config/presets.ts` gives each kind its defaults; presets and the Folders card both use it.
- The root `.editorconfig` header records the preset (`# Settings for .NET SDK X, catalog D, preset NAME`) and what each folder holds (`# Projects: src library; tests test`), and repo import reads both back. Keep `HEADER_PATTERN` and `PROJECTS_PATTERN` in `src/lib/export/editorConfigFiles.ts` in sync with the header.
- Bump `SCHEMA_VERSION` in `src/lib/config/shareLink.ts` when the config shape changes in a way old saved state can't be read as, and add the migration in the same change.
- `catalog/generated/rule-history.json` only grows: CatalogBuilder adds new rule IDs with the run date and never rewrites old dates. Don't edit it by hand.

## Generated output

- Option groups and their titles live in `src/lib/catalog/optionGroups.ts`. A unit test fails when dotnet/docs adds a group that isn't listed.

- `.editorconfig` comments always sit on their own line above the setting. EditorConfig has no inline comments.
- Generated files carry no site attribution.
- Never emit a key the selected SDK band or the target frameworks' C# version doesn't support.
- MSBuild properties come from `src/lib/build/buildProperties.ts`. Shared props never set `LangVersion`, `WarningLevel` or `NoWarn`.
- Shared props set `TargetFramework` or `TargetFrameworks` only when a folder opts in with "Set the target frameworks for every project here" (`isTargetFrameworkShared`). `toTargetFrameworkLines` in `src/lib/build/buildPropsFiles.ts` also clears an inherited value that would conflict.

## Tests

- Prefer end-to-end and system tests: Playwright, plus CI building real projects with generated files.
- Unit tests for complex logic only: generators, scope inheritance, version gating, migrations, validation and the CatalogBuilder parsers.
- C# test names follow `Method_Condition_ExpectedResult`.
