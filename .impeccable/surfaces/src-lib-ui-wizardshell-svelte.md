---
version: 1
slug: "src-lib-ui-wizardshell-svelte"
primary_target: "src/lib/ui/WizardShell.svelte"
related_targets: ["src/app.css"]
---

Scope: the whole app (wizard steps, review, /rules, /options), visitor mode Operate.
Audience: experienced C# developers; job: pick a preset, tune settings or hundreds of rule severities, read and export the generated files.
Constraints: utility copy (short labels, bullets, no walls of text), US English, light and dark from the system setting, WCAG 2.2 AA, every axe check passing.

## Direction contract

THESIS: The category standard, executed at Microsoft Learn and Azure portal craft. Refuses nothing about the expected arrangement; refuses sloppiness: misaligned grids, inconsistent spacing, browser-default controls, prose where a list would do.

OWN-WORLD: Fluent 2. Neutral gray canvas (#F5F5F5 light, #1F1F1F dark) with white (#FFFFFF / #292929) layers, Fluent brand blue #0F6CBD for primary actions, selection and the active nav item. Fluent's web font stack (Segoe UI Variable, Segoe UI, then the platform sans) at Fluent's scale (12/14/16/20/28). Selawik isn't self-hosted: no published web build exists, and Fluent's own web stack falls back to the platform sans. Cascadia Code for IDs, keys and file content. 4px radii on controls, 8px on cards, Fluent shadow2/shadow4 elevation. Status colors from Fluent: danger #C50F1F, warning #BC4B09-ish amber, success #107C10, informative brand.

STORY: The visitor sees where they are (step, folder), changes a setting, and watches the exact file line change in the preview beside it.

FIRST VIEWPORT: 48px app header (product name, folder switcher, share/download). Left nav rail of the nine steps with icons, active item brand-tinted. Center: step title, one-line purpose, then cards of settings. Right: file preview pane with file tabs, always visible on desktop. Primary action sits in the header (Download zip).

FORM: Canon (Fluent 2 product UI), the category standard taken as the standing exit; seed key 377ac1e8.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
