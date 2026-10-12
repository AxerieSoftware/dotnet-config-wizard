# Agent guide

How to work in this repo. [README.md](README.md) covers what the app does and the commands; [docs/catalog.md](docs/catalog.md) covers where rule and option data comes from.

## Every change

Before calling a change done, review the diff against this guide and clean it up:

- `npm run check` passes (typecheck, lint, knip, unit tests).
- `npm run e2e` passes, with new behavior covered by an end-to-end test.
- `dotnet test --solution dotnet-config-wizard.slnx` passes when anything under `tools/` changed.
- `npm run catalog` runs cleanly when CatalogBuilder or the catalog format changed, and the regenerated `catalog/generated` is committed.

## Code

Follow [docs/code-style.md](docs/code-style.md). In short:

- **Self-documenting first.** Descriptive names, no abbreviations. If code needs a comment to explain what it does, rename or restructure first.
- **Comments** say why, not what. Never restate the code, narrate a change or mention earlier iterations.
- **Vertical slices.** Each wizard feature keeps its model, generator, validation and components together under `src/lib/<feature>/`.
- **Generators are plain functions** from the config model to file text. No plugin systems or generic generator abstractions.
- **No over-implementation.** Handle what users can hit. No speculative options, guards or abstractions. This limits app code and UI toggles, not the catalog: every cataloged rule and option stays configurable.
- **US English** in UI copy, comments and docs.
- **Greenfield.** No compatibility shims or leftovers from earlier iterations, except share-link migrations, which exist so old links keep their meaning.

## Generated output

- `.editorconfig` comments always sit on their own line above the setting. EditorConfig has no inline comments.
- Generated files carry no site attribution.
- Never emit a key the selected SDK band, LangVersion or TFM doesn't support.

## Tests

- Prefer end-to-end and system tests: Playwright, plus CI building real projects with generated files.
- Unit tests for complex logic only: generators, scope inheritance, version gating, migrations, validation and the CatalogBuilder parsers.
- C# test names follow `Method_Condition_ExpectedResult`.
