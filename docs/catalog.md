# Catalog sources

Where the wizard's rule and option data comes from, and the facts about the .NET SDK that CatalogBuilder relies on. Each fact below was checked on SDK 10.0.300; CatalogBuilder asserts the folder layout on every run.

## What CatalogBuilder reads

| Output | Source |
| --- | --- |
| `sdk-<band>.json` `rules` | Every C# `DiagnosticAnalyzer` in the SDK's code-style and NetAnalyzers assemblies, read through `SupportedDiagnostics`. |
| `sdk-<band>.json` `analysisLevels` | The SDK's `analysislevel_<level>_<mode>.globalconfig` files: level, then mode, then rule ID to severity. |
| `style-options.json` | The property tables in dotnet/docs `docs/fundamentals/code-analysis/style-rules`. |

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

## Tooling facts

- Biome 2.5 formats Svelte template markup, not just `<script>` and `<style>`, when `html.experimentalFullSupportEnabled` is on. The repo uses Biome only.
