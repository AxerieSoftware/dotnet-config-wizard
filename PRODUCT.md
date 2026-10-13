# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Experienced C# developers: tech leads and senior developers setting up or standardizing a team repo, and the author, for their own repos. They know what an analyzer, `Directory.Build.props` and central package management are; they want the settings decided quickly and correctly, not explained from scratch. They compare presets, check what each rule does, and share a link with their team before committing the files.

## Product Purpose

A wizard that writes a .NET repo's build configuration: `.editorconfig`, `Directory.Build.props`, `Directory.Packages.props`, `global.json`, `nuget.config`, `.gitattributes`, `BannedSymbols.txt`, `SonarLint.xml` and an optional `Analyzers.globalconfig`. Success is files a team drops into a repo that build on the first try, read as documentation, and make every developer's build enforce the same rules.

## Positioning

The catalog is read from each .NET SDK band and analyzer package themselves, not hand-maintained, and every preset is proven by building real sample projects with each SDK. So it covers every option and rule that exists for the selected SDK and packages, gates them by C# version, and never emits a key Roslyn ignores. Output is grouped and commented by meaning, with one active rule per concern across analyzers.

## Operating Context

- Used on desktop next to an editor and a terminal; output is copied or downloaded as a zip and committed.
- Configs are shared as links and saved in the browser automatically.
- Existing `.editorconfig`, MSBuild files and `.ruleset` files can be imported; re-importing an older file lists rules added since.
- Per-folder scopes (root, `src`, `tests`, custom) inherit from the closest parent.
- Reference pages for every rule and option at `/rules` and `/options`.

## Capabilities and Constraints

- Pure client-side SvelteKit app, prerendered, hosted on GitHub Pages at dotnetconfig.axerie.com.
- .NET 10 and later only, as SDK and target framework; no .NET Framework or .NET Standard. LangVersion is never set.
- Only maintained analyzer packages (a release in the last 18 months, not deprecated).
- Generated files carry no attribution to the site.
- The wizard is the product's front door; there is no separate landing page.

## Brand Commitments

- US English. Copy is plain and direct, written for experienced developers: no marketing voice.
- Visual standard: the category standard, Fluent 2 as Microsoft ships it, executed at full fidelity. The craft bar is Microsoft Learn and the Azure portal. Chosen over a distinctive identity on 2026-10-12.
- Utility over prose: concise labels and bullet points, never walls of text.

## Evidence on Hand

- The rule catalog (`catalog/generated/`), presets (`src/lib/config/presets.ts`) and validation results are the only proof points. There are no users, testimonials or adoption numbers; don't invent them.

## Product Principles

1. Correct over complete-looking: every emitted key is one the selected SDK and packages read.
2. Defaults follow Microsoft's guidance, and the files say why.
3. Respect the reader's expertise: show the real rule IDs, properties and file contents.
4. The output is the product: what the user sees in the preview is exactly what gets committed.

## Accessibility & Inclusion

WCAG 2.2 AA. Every wizard step passes axe checks in the Playwright suite, and the rule table is keyboard navigable.
