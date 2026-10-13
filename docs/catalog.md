# Catalog sources

Where the wizard's rule and option data comes from, and the facts about the .NET SDK that CatalogBuilder relies on. Each fact below was checked on SDK 10.0.300; CatalogBuilder asserts the folder layout on every run.

## SDK bands

The catalog covers the latest SDK of every .NET channel from 10.0 on that isn't end of life, read from `releases-index.json`. `scripts/buildCatalog.ts` installs each one side by side into `.cache/dotnet` with Microsoft's `dotnet-install.sh`, and `bands.json` records each band's support phase and end-of-life date.

## What CatalogBuilder reads

| Output | Source |
| --- | --- |
| `sdk-<band>.json` `rules` | Every C# `DiagnosticAnalyzer` in the SDK's code-style and NetAnalyzers assemblies, in the band's `Microsoft.NET.ILLink.Tasks` package (IL2xxx/IL3xxx) and in its ASP.NET Core targeting pack (ASPxxxx, BLxxxx), read through `SupportedDiagnostics`, plus every compiler warning (CSxxxx). |
| `sdk-<band>.json` `analysisLevels` | The SDK's `analysislevel_<level>_<mode>.globalconfig` files: level, then mode, then rule ID to severity. |
| `package-<id>.json` | The rules of each analyzer package listed in `catalog/packages.json`, at its newest stable version, or its newest prerelease when no stable release is under 18 months old. |
| `packages.json` | Each package's version, newest release (prereleases included), publish date and deprecation, for the maintenance gate. |
| `bands.json` | `releases-index.json` support details for each band the run read. |
| `style-options.json` | The property tables in dotnet/docs `docs/fundamentals/code-analysis/style-rules`, including `includes/`, which rule pages pull in with `[!INCLUDE]`. |

Analyzers are loaded with the Roslyn build that ships in the same SDK, through reflection, so each band is read exactly as `dotnet build` runs it. Packages don't vary by SDK, so they're read once against the newest supported release's Roslyn.

- **Code fixes.** A rule has one when some `CodeFixProvider` in the same assemblies lists it in `FixableDiagnosticIds`.
- **Rule parameters.** Sonar-style `[RuleParameter]` attributes on analyzer properties become parameters, written to `SonarLint.xml`.
- **Sonar descriptions** aren't copied, because Sonar's license doesn't allow republishing them; rules link to rules.sonarsource.com instead.
- **Compiler warnings** come from Roslyn's internal `ErrorCode` enum (`WRN_*`), with titles from its resources and levels from `ErrorFacts.GetWarningLevel`. Levels 1 to 4 are always on; 5 and up are warning waves. Docs links come from the `f1_keywords` of the dotnet/docs compiler-message pages.
- **Type-load failures** in packages are usually Roslyn helper types embedded for another Roslyn version. They're notes unless the type looks like an analyzer or code fix, which fails the run.
- **Missing dependencies** don't name the types they break, so CatalogBuilder compares the analyzer-like type names in the assembly's metadata with the types that loaded. ASP.NET Core's editor features, for example, need `Microsoft.CodeAnalysis.ExternalAccess.AspNetCore`, which only Visual Studio ships; every one of its analyzers still loads.
- **Rule IDs** can be mixed case, such as `xUnit1000` and `NUnit1001`.
- **Package folder layouts** vary: `analyzers/` (Sonar), `analyzers/cs/` (VS Threading), `analyzers/dotnet/` (PublicApi), `analyzers/dotnet/cs/`, and Roslyn-versioned `analyzers/dotnet/roslynX.Y/cs/` (Meziantou), where the newest version the host Roslyn can load wins.

## Packages that come with another package

Some analyzers arrive through the package that needs them: `xunit.analyzers` through xunit.v3, `MSTest.Analyzers` through MSTest.Sdk and MSTest, and `Microsoft.EntityFrameworkCore.Analyzers` through Microsoft.EntityFrameworkCore. Their `catalog/packages.json` entry names that package in `includedWith`. The wizard lets you select them to configure their rules but never references them, so it can't pin a version that conflicts with the framework's own. ASP.NET Core's analyzers ship in the SDK's targeting pack and run in every web project, so they're part of each band's rules.

## Weekly refresh

`.github/workflows/refresh-catalog.yml` runs every Monday and on demand. It rebuilds the catalog, regenerates this repo's own config files, runs the checks and validate-output, and opens or updates one `catalog-refresh` pull request. `scripts/summarizeCatalog.ts` writes its description: new and removed rules by source, SDK and package version changes, and packages that fail the maintenance gate (no release in 18 months, or deprecated).

- Labels: `catalog` always, `stale-package` when a package fails the gate, and `needs-attention` when a check fails. A stale package never fails the run, so one package can't hold back the rest.
- Pull requests opened with `GITHUB_TOKEN` don't trigger other workflows, which is why the job runs the checks itself. The repo setting "Allow GitHub Actions to create and approve pull requests" must be on.
- When a new SDK band replaces one, `config/dogfood.json` and the tests that name the old band need updating by hand; the pull request is labeled `needs-attention` until they are.

## SDK layout

Paths are relative to `<dotnet root>/sdk/<version>/`.

| Path | Contents |
| --- | --- |
| `Sdks/Microsoft.NET.Sdk/codestyle/cs/` | IDE rules: `Microsoft.CodeAnalysis.CodeStyle.dll`, `Microsoft.CodeAnalysis.CSharp.CodeStyle.dll` and their `.Fixes` assemblies. |
| `Sdks/Microsoft.NET.Sdk/analyzers/` | CA rules: `Microsoft.CodeAnalysis.NetAnalyzers.dll` and `Microsoft.CodeAnalysis.CSharp.NetAnalyzers.dll`. |
| `Sdks/Microsoft.NET.Sdk/analyzers/build/config/` | 770 `analysislevel*.globalconfig` files covering levels 5–11, every mode, every category, and `_warnaserror` variants. |
| `Roslyn/bincore/` | The compiler the analyzers load against. |
| `DotnetTools/dotnet-format/` | `Microsoft.CodeAnalysis.Workspaces` and `Microsoft.Bcl.AsyncInterfaces`, which some analyzer types need to load. |

Trim and AOT analyzers (`IL2xxx`, `IL3xxx`) aren't in the SDK folder. They ship as `analyzers/dotnet/cs/ILLink.RoslynAnalyzer.dll` in the `Microsoft.NET.ILLink.Tasks` package, which the SDK restores implicitly.

## IDE rules that never run on build

dotnet/docs documents 14 IDE rules that the SDK's code-style assemblies don't report: IDE0001, IDE0002, IDE0003, IDE0035, IDE0038, IDE0049, IDE0050, IDE0079, IDE0081, IDE0084, IDE0140, IDE0410, IDE1007 and IDE3000. A test build with each set to `error` and an obvious violation produced no diagnostic, while IDE0161 failed the build as expected. These rules only show in the editor, so a rule is build-enforced exactly when it appears in `sdk-<band>.json`.

## Version requirements

- An "Applicable languages" cell such as `C# 12+` gives a rule's minimum C# version. An option gets one only when every rule it feeds has one; IDE0028 uses `dotnet_style_prefer_collection_expression` on any version.
- Gaps in the docs, such as C# 10 for IDE0161, live in `src/lib/catalog/versionOverlay.ts`.
- The wizard supports .NET 10 and later only, as SDK and as target framework; there's no .NET Framework or .NET Standard. Every rule's API needs are met from net10.0, so only the C# version gates rules.
- Without LangVersion, the compiler uses the target framework's default C# version (C# 14 for net10.0, C# 15 for net11.0); with several frameworks, the oldest default decides.

## AnalysisLevel files

Each `analysislevel_<level>_<mode>.globalconfig` lists only the CA rules that mode changes: `recommended` and `all` raise rules to warning, `none` turns rules off, and `default` only turns off rules released after its level. A rule a mode doesn't list keeps its analyzer's own default, so the catalog keeps every entry, including `none`.

## Docs table conventions

- A value cell with several codes separated by commas, such as `` `methods`, `properties` ``, lists values that combine. Codes separated by `&#124;`, such as `` `true` &#124; `when_types_exactly_match` ``, are aliases for one value.
- Options documented only in `includes/` have no languages of their own and take them from the rules that list them.
- A rule's `Rule ID` cell can hold several IDs, such as `IDE0390, IDE0391`.

## Tooling facts

- Chromium renames a downloaded `.editorconfig` to `editorconfig.txt`, so the wizard always downloads a zip.
- Biome 2.5 formats Svelte template markup, not just `<script>` and `<style>`, when `html.experimentalFullSupportEnabled` is on. The repo uses Biome only.
