---
name: .NET Config Wizard
description: Fluent 2 product UI for writing a .NET repo's build configuration.
colors:
  canvas: "#f5f5f5"
  layer: "#ffffff"
  layer-alt: "#fafafa"
  layer-hover: "#f5f5f5"
  layer-pressed: "#e0e0e0"
  subtle: "#f0f0f0"
  text: "#242424"
  text-2: "#424242"
  text-3: "#616161"
  text-disabled: "#bdbdbd"
  stroke: "#d1d1d1"
  stroke-2: "#e0e0e0"
  stroke-accessible: "#616161"
  brand: "#0f6cbd"
  brand-hover: "#115ea3"
  brand-pressed: "#0c3b5e"
  brand-text: "#115ea3"
  brand-tint: "#ebf3fc"
  brand-tint-stroke: "#b4d6fa"
  on-brand: "#ffffff"
  danger-tint: "#fdf3f4"
  danger-stroke: "#eeacb2"
  danger-text: "#b10e1c"
  warning-tint: "#fff9f5"
  warning-stroke: "#fdcfb4"
  warning-text: "#8a3707"
  success-tint: "#f1faf1"
  success-stroke: "#9fd89f"
  success-text: "#0e700e"
  code-comment: "#5c7a5c"
typography:
  title-page:
    fontFamily: "Segoe UI Variable Text, Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.01em"
  subtitle:
    fontFamily: "Segoe UI Variable Text, Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  body-strong:
    fontFamily: "Segoe UI Variable Text, Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  caption:
    fontFamily: "Segoe UI Variable Text, Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, Helvetica Neue, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  mono:
    fontFamily: "Cascadia Code, Cascadia Mono, Consolas, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "liga 0"
rounded:
  code: "3px"
  control: "4px"
  surface: "8px"
  pill: "999px"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-default:
    backgroundColor: "{colors.layer}"
    textColor: "{colors.text}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
    height: "32px"
  button-default-hover:
    backgroundColor: "{colors.layer-hover}"
  button-default-pressed:
    backgroundColor: "{colors.layer-pressed}"
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-primary-pressed:
    backgroundColor: "{colors.brand-pressed}"
  button-subtle:
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "5px 12px"
  button-subtle-hover:
    backgroundColor: "{colors.layer-hover}"
  button-small:
    typography: "{typography.caption}"
    padding: "1px 8px"
    height: "24px"
  input:
    backgroundColor: "{colors.layer}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "5px 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.layer}"
    rounded: "{rounded.surface}"
    padding: "16px 20px"
  badge:
    backgroundColor: "{colors.subtle}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
    height: "20px"
  badge-brand:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-text}"
  badge-warning:
    backgroundColor: "{colors.warning-tint}"
    textColor: "{colors.warning-text}"
  badge-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger-text}"
  message:
    backgroundColor: "{colors.layer-alt}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  nav-item:
    textColor: "{colors.text-2}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-text}"
  preset-selected:
    backgroundColor: "{colors.brand-tint}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  file-tab:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
    padding: "8px 10px"
    height: "40px"
---

# Design System: .NET Config Wizard

## Overview

**Creative North Star: "Fluent 2, as Microsoft ships it"**

- The category standard, executed at Microsoft Learn and Azure portal craft. No distinctive identity: fidelity is the identity.
- Dense, quiet product UI for experienced developers. Labels and bullets, not paragraphs.
- Gray canvas, white layers, one brand blue. Real IDs, keys and file content are shown in Cascadia Code.
- Light and dark follow the system setting (`prefers-color-scheme`). No manual theme toggle.
- All tokens live as custom properties on `:root` in `src/app.css`. There are no component-scoped `<style>` blocks.

**Key Characteristics:**
- Neutral canvas with white cards on Fluent shadow4
- Brand blue only for primary action, selection and the active item
- Fluent type ramp (12/14/16/28), weight 400 or 600 only
- 4px control radius, 8px surface radius
- Fluent UI System Icons, 20px regular, inline SVG
- Three-pane wizard: step rail, settings, live file preview

## Colors

Fluent 2 neutral ramp plus a single brand blue and tint-based status colors. Frontmatter holds the light values; dark values are in `.impeccable/design.json` (`colorMeta.*.dark`) and `src/app.css`.

### Primary
- **Fluent Communication Blue** (`brand`): primary buttons, focused input underline, selected file tab, site-nav underline, checkbox accent.
- **Brand Hover / Pressed** (`brand-hover`, `brand-pressed`): primary button states only.
- **Brand Text** (`brand-text`): links, `<summary>` toggles, rule ID links, suggestion severity, info icons.
- **Brand Tint** (`brand-tint`, `brand-tint-stroke`): active step, selected preset, brand badge, text selection, changed settings.

### Neutral
- **Canvas** (`canvas`): page background behind cards.
- **Layer** (`layer`): cards, header, preview pane, inputs, default buttons, grid rows.
- **Layer Alt** (`layer-alt`): step rail, grid header, code blocks, message bars, bulk bar.
- **Subtle** (`subtle`): inline code, neutral badges, disabled fills.
- **Text ramp** (`text`, `text-2`, `text-3`, `text-disabled`): primary, secondary (nav, tabs), tertiary (notes, captions, descriptions), disabled.
- **Strokes** (`stroke`, `stroke-2`, `stroke-accessible`): control borders, dividers, focus ring and input bottom edge.

### Status
- **Danger / Warning / Success**: each a tint fill + stroke + text trio. Used for message bars, badges, severity text and issue icons.
- **Code Comment** (`code-comment`): comment lines in generated file previews.

### Named Rules
**The One Blue Rule.** Brand blue marks the primary action, selection and the current location. Nothing decorative.
**The Tint Not Fill Rule.** Status is tint background + stroke + darker text. No solid red, amber or green fills.

## Typography

**UI Font:** Segoe UI Variable Text (Segoe UI, then the platform sans). Not self-hosted.
**Mono Font:** Cascadia Code, self-hosted via `@fontsource/cascadia-code` (400, 600), ligatures off.

**Character:** Windows-native sans for chrome; Cascadia only where the content is code.

### Hierarchy
- **Page title** (600, 28px/36px, -0.01em): one `h1` per step or reference page.
- **Subtitle** (600, 16px/22px): card `h2`, app title.
- **Body strong** (600, 14px/20px): `h3`, buttons, field labels, legends.
- **Body** (400, 14px/20px): default text, inputs.
- **Caption** (400, 12px/16px): captions, badges, grid header, breadcrumb, folder label.
- **Mono** (13px): rule IDs and option keys (600), inline code, file tabs, textareas.

### Named Rules
**The Mono Means Literal Rule.** Cascadia Code is for IDs, keys, file names and file content. Never for labels or headings.
**The Two Weights Rule.** 400 and 600 only.

## Layout

- **Header:** 48px, sticky, white layer with bottom divider. Product name, site nav (Wizard / Rules / Options), actions right (subtle Copy share link, primary Download zip).
- **Wizard grid:** 232px step rail | settings column (max 960px; 1200px on wide steps) | preview pane `minmax(360px, 34vw)`. Rail and preview are sticky full-height.
- **Step column:** step header (`h1` + one line, max 72ch), stack of cards with 16px gaps, footer with previous (default) and next (primary) buttons.
- **Reference pages:** single centered column, max 1000px, padding 24px 32px 48px. Lists flow in two columns (min 320px).
- **Spacing:** 4px base; 2/4/8/12/16/24/32 in use. Row dividers at 10px vertical padding.
- **Breakpoints:**
  - ≤1100px: one column; step rail becomes a sticky horizontal strip; preview drops below at 70vh.
  - ≤640px: header buttons go icon-only (labels visually hidden), page padding 16px, two-column rows stack, rule grid drops two columns.

## Elevation & Depth

Tonal layering first (canvas → layer → layer-alt), Fluent shadows second. Panes are separated by 1px `stroke-2` dividers, not shadows.

### Shadow Vocabulary
- **shadow4**: every card.
- **shadow16**: popovers (share popover).
- Dark mode doubles shadow opacity. Exact values in the sidecar.

### Named Rules
**The Cards Float, Panes Don't Rule.** Shadows go on cards and popovers. Header, rail and preview use borders.

## Shapes

- 4px on controls, message bars, code blocks, nav items and the rule grid.
- 8px on cards and popovers.
- Pill (999px) on badges only. 3px on inline code.
- Tabs and the site nav are square with a 2px bottom indicator.
- Inputs: 1px stroke, darker bottom edge (`stroke-accessible`).

## Components

### Buttons
- **Shape:** 4px, min-height 32px, padding 5px 12px, weight 600, 6px icon gap.
- **Default:** white layer, `stroke` border. Hover `layer-hover`, pressed `layer-pressed`.
- **Primary:** brand fill, no border, white text. One per view region (header Download zip, footer Next).
- **Subtle:** transparent, weight 400. Header secondary actions, dismiss.
- **Small:** 24px, 12px text. Inline row actions.
- **Disabled:** `subtle` fill, `text-disabled`.
- **Motion:** background 100ms `cubic-bezier(0.33, 0, 0.67, 1)`; off under reduced motion.

### Inputs / Fields
- **Style:** white, 1px stroke with `stroke-accessible` bottom edge, 4px, 32px high.
- **Focus:** 2px brand bottom border, no outline.
- **Select:** native, `appearance: none`, Fluent chevron at right 8px.
- **Changed:** a value that differs from the inherited or default one gets brand tint fill, `brand-tint-stroke` border, brand bottom edge and brand text at 600. Unset and redundant values stay neutral.
- **Field:** label (600) above control, 4px gap. Field grids `auto-fill minmax(200px, 1fr)`.
- **Checkbox / radio:** native 16px, `accent-color: brand`.

### Cards
- **Style:** white layer, 8px radius, shadow4, padding 16px 20px, 12px internal gap.
- **Header:** `h2` + optional `note` line under it.
- **Rows:** option/rule rows in a two-column grid (name | 160–220px control), 1px `stroke-2` dividers.

### Badges and Message Bars
- **Badge:** pill, 20px, 12px/600, neutral / brand / warning / danger.
- **Message bar:** 4px, padding 8px 12px, leading 20px icon tinted by status, tint fill + stroke.

### Navigation
- **Step rail:** `layer-alt`, items 36px with 20px icon, 4px radius. Hover `layer-hover`; current is brand tint + brand text + 600. Review shows a warning count badge.
- **Site nav:** text links in the header, current gets 2px brand underline + 600.
- **Folder switcher:** caption label + select, top of the rail.

### File Preview (signature)
- Tab strip of mono file names, 40px, 2px brand underline on the selected tab.
- Panel: `<pre>` in Cascadia, comments in `code-comment`, horizontal scroll, thin scrollbars.
- In cards (review step): `layer-alt` fill, 1px stroke, 4px radius, max 560px.

### Rule Grid
- Virtualized grid: rule (ID + name, 2-line clamp) | source | severity text | control.
- Sticky 36px `layer-alt` header in caption 600. Rows hover `layer-hover`.
- Severity as colored text: error danger, warning warning, suggestion brand, silent/none tertiary.

### Preset Picker
- Grid of default buttons `minmax(220px, 1fr)`, left-aligned title (600) + caption.
- Selected: brand border, brand tint, inset 1px brand ring, `aria-pressed`.

## Do's and Don'ts

### Do:
- **Do** use the `:root` custom properties in `src/app.css`; add a token there before using a new value.
- **Do** use Fluent UI System Icons from `@fluentui/svg-icons`, 20px regular (16px small), through `Icon.svelte`.
- **Do** show real IDs, keys and file content in Cascadia Code.
- **Do** keep the focus ring: 2px `stroke-accessible` outline, 1px offset.
- **Do** underline links inside running text (`p`, `dd`, `.note`, `.caption`).
- **Do** write copy as short labels, one-line purposes and bullets.

### Don't:
- **Don't** use brand blue for decoration, headings or large fills.
- **Don't** use solid status fills; use the tint trio.
- **Don't** add shadows to panes, rows or the header.
- **Don't** add a second UI typeface or self-host a UI face.
- **Don't** use icons outside the Fluent System Icons set or emoji as icons.
- **Don't** add a manual theme switch; follow `prefers-color-scheme`.
