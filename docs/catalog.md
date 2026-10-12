# Catalog sources

Where the wizard's rule and option data comes from, and the facts about the .NET SDK that CatalogBuilder relies on. Each fact below was checked on SDK 10.0.300; CatalogBuilder asserts the folder layout on every run.

## SDK bands

The catalog covers the latest SDK of every .NET channel from 10.0 on that isn't end of life, read from `releases-index.json`. `scripts/buildCatalog.ts` installs each one side by side into `.cache/dotnet` with Microsoft's `dotnet-install.sh`, and `bands.json` records each band's support phase and end-of-life date.

## What CatalogBuilder reads

| Output | Source |
| --- | --- |
| `sdk-<band>.json` `rules` | Every C# `DiagnosticAnalyzer` in the SDK's code-style and NetAnalyzers assemblies, read through `SupportedDiagnostics`. |
| `sdk-<band>.json` `analysisLevels` | The SDK's `analysislevel_<level>_<mode>.globalconfig` files: level, then mode, then rule ID to severity. |
| `bands.json` | `releases-index.json` support details for each band the run read. |
| `style-options.json` | The property tables in dotnet/docs `docs/fundamentals/code-analysis/style-rules`, including `includes/`, which rule pages pull in with `[!INCLUDE]`. |

Analyzers are loaded with the Roslyn build that ships in the same SDK, through reflection, so each band is read exactly as `dotnet build` runs it.

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

## Docs table conventions

- A value cell with several codes separated by commas, such as `` `methods`, `properties` ``, lists values that combine. Codes separated by `&#124;`, such as `` `true` &#124; `when_types_exactly_match` ``, are aliases for one value.
- Options documented only in `includes/` have no languages of their own and take them from the rules that list them.
- A rule's `Rule ID` cell can hold several IDs, such as `IDE0390, IDE0391`.

## Tooling facts

- Chromium renames a downloaded `.editorconfig` to `editorconfig.txt`, so the wizard always downloads a zip.
- Biome 2.5 formats Svelte template markup, not just `<script>` and `<style>`, when `html.experimentalFullSupportEnabled` is on. The repo uses Biome only.
