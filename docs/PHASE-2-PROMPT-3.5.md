# Prompt 3.5 — Rebrand to Signature blue (before Prompt 4)

Save this file as `docs/PHASE-2-PROMPT-3.5.md` on `phase-2-app`, then give Cline the prompt
block below. It replaces the pine green from Prompt 3 everywhere. Nothing else in the UI kit
changes behavior.

```
Read .clinerules, docs/APP-SPEC.md section 4, and this file (docs/PHASE-2-PROMPT-3.5.md) first.

Task: replace the pine green brand with Signature blue. No new components, no pages, no new
packages, no layout changes.

1. Replace docs/design/tokens.css with the file in "Token file" below, verbatim. Then copy it
   to apps/web/src/styles/tokens.css verbatim (APP-SPEC 4.1 still says they must match).

2. The token family `pine` is renamed `brand`. Update every Tailwind class in apps/web/src:
     bg-pine → bg-brand          text-pine → text-brand
     border-pine → border-brand  bg-pine-tint → bg-brand-tint
     hover:bg-pine-hover → hover:bg-brand-hover
     text-pine-on → text-brand-on   focus:border-pine → focus:border-brand
     focus:bg-pine → focus:bg-brand   focus-within:border-pine → focus-within:border-brand
   Files that use them today: ui/Button.tsx, ui/DayToggle.tsx, ui/FileDrop.tsx, ui/Logo.tsx,
   ui/NumberField.tsx, ui/Select.tsx, ui/SkipLink.tsx, ui/Textarea.tsx, dev/Gallery.tsx.
   Exception: in ui/Button.tsx the `danger` variant uses `text-pine-on` today. Change it to
   `text-block-on` (a new token: white in light, near-black in dark), not `text-brand-on`.
   After the change, `grep -rn "pine" apps/web/src` must return nothing.

3. Panels lose their shadow. ui/Panel.tsx: remove `shadow-panel` (border only). Dialog, Menu
   and Toast keep `shadow-pop`. The token `--sh-panel` is deleted from tokens.css, so remove
   `shadow-panel` from the @theme block's users if any remain.

4. apps/web/index.html favicon: replace every `%230B6E5A` (#0B6E5A) in the data URI with
   `%2326348C` (#26348C). Same four-square mark, same shape. index.html is outside src, so the
   hex rule does not apply to it.

5. docs/APP-SPEC.md section 4.2: replace "pine" with "brand" in the Button, DayToggle and
   FileDrop rows. Section 4.1: add one line under Panels: "Panels have a border and no
   shadow; only dialogs, menus and toasts float (shadow-pop)."
   docs/PHASE-2-CLINE-PROMPTS.md Prompt 12, the offline page line: "the pine green already
   in tokens.css" → "the Signature blue (--brand) already in tokens.css".
   .clinerules "Visual target" line: append "Colors come from docs/design/tokens.css only;
   the prototype's green is superseded."

6. Tests: update any test that asserts a `pine` class name to the `brand` name. Add one test
   to apps/web/test/ui.test.tsx: Button variant primary renders with class `bg-brand`.

Finish:
- From root: npm run typecheck, npm test, npm run build. All pass.
- grep -rn "pine" apps/web/src docs/APP-SPEC.md returns nothing.
- Paste the summaries and the check-bundle table.
- Commit "style(web): Signature blue tokens replace pine", then push.
```

## Token file

```css
/*
 * CarePlan Scheduler — design tokens (Phase 2, Signature blue)
 *
 * Copy this file verbatim to apps/web/src/styles/tokens.css. It is the only place colors,
 * fonts, radii and shadows are defined. Components use the Tailwind names in the
 * `@theme inline` block at the bottom (e.g. `bg-surface`, `text-ink-2`, `border-line`),
 * never a literal hex value.
 *
 * Direction: plain, civic and exact. Public Sans is the US Web Design System typeface, read by
 * state reviewers and agency staff as government-grade. The brand is Signature blue: the ink a
 * care plan is signed in. The filled 15-minute unit is that ink, so the product's own color
 * always means "scheduled, and within the rules". Red appears only when a rule is broken.
 * Severity colors stay clear of the brand and always appear with an icon and a word.
 * Every text pair passes WCAG AA (4.5:1); input borders pass 3:1 against their surface.
 *
 * Theme: light by default; dark follows the operating system unless the person picks a
 * theme in Account, which sets data-theme="light" | "dark" on <html>.
 */

:root {
  /* Neutrals (faint blue bias, never pure grey) */
  --paper: #F5F6F8;        /* page background */
  --surface: #FFFFFF;      /* panels, inputs, menus */
  --sunk: #ECEFF4;         /* wells, table heads, non-care days */
  --ink: #161B26;          /* primary text (15.9:1 on paper) */
  --ink-2: #4A5263;        /* secondary text, labels (7.8:1 on surface) */
  --ink-3: #687083;        /* hints, placeholders (5.0:1 on surface) */
  --line: #D5DAE3;         /* dividers, panel borders */
  --line-2: #8790A3;       /* input borders (3.2:1 on surface) */

  /* Brand = scheduled and compliant */
  --brand: #26348C;        /* 10.8:1 with white */
  --brand-hover: #1B2670;
  --brand-tint: #E6E9F7;   /* "we chose this day", hover fills */
  --brand-on: #FFFFFF;     /* text on brand */

  /* One 15-minute unit */
  --tile: #26348C;
  --tile-empty: #C9D0EC;   /* available; filled tile on it is 7.0:1 */

  /* Severities (text color / background) */
  --block: #B42318;  --block-bg: #FDECEA;  --block-on: #FFFFFF;  /* Must fix */
  --review: #7A2E8E; --review-bg: #F5EAF8;  /* Needs review (rule not yet verified) */
  --warn: #8A4B08;   --warn-bg: #FCF1DE;    /* Check */
  --info: #3F4A5A;   --info-bg: #EDF0F4;    /* Good to know (slate, never brand blue) */

  --focus: #26348C;
  --overlay: rgba(22, 27, 38, 0.45);
  --sh-pop: 0 8px 24px rgba(22, 27, 38, 0.14);

  /* Type */
  --font-body: "Public Sans Variable", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;

  /* Shape */
  --r-sm: 6px;   /* controls, chips, cells */
  --r-md: 10px;  /* panels, dialogs */
  --r-pill: 999px;

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #0E1119; --surface: #151A26; --sunk: #1B2130;
    --ink: #E6E9F0; --ink-2: #A8AFBF; --ink-3: #8B93A5;
    --line: #2A3142; --line-2: #6B7489;
    --brand: #9DAAF2; --brand-hover: #B8C2F6; --brand-tint: #1E2547; --brand-on: #0D1233;
    --tile: #9DAAF2; --tile-empty: #2D3558;
    --block: #F4887C; --block-bg: #3B1B18; --block-on: #2A0D0A;
    --review: #D9A6E8; --review-bg: #33203B;
    --warn: #F1B661; --warn-bg: #3A2B13;
    --info: #B4BCCB; --info-bg: #222938;
    --focus: #B8C2F6;
    --overlay: rgba(0, 0, 0, 0.6);
    --sh-pop: 0 8px 24px rgba(0, 0, 0, 0.5);
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
  --paper: #0E1119; --surface: #151A26; --sunk: #1B2130;
  --ink: #E6E9F0; --ink-2: #A8AFBF; --ink-3: #8B93A5;
  --line: #2A3142; --line-2: #6B7489;
  --brand: #9DAAF2; --brand-hover: #B8C2F6; --brand-tint: #1E2547; --brand-on: #0D1233;
  --tile: #9DAAF2; --tile-empty: #2D3558;
  --block: #F4887C; --block-bg: #3B1B18; --block-on: #2A0D0A;
  --review: #D9A6E8; --review-bg: #33203B;
  --warn: #F1B661; --warn-bg: #3A2B13;
  --info: #B4BCCB; --info-bg: #222938;
  --focus: #B8C2F6;
  --overlay: rgba(0, 0, 0, 0.6);
  --sh-pop: 0 8px 24px rgba(0, 0, 0, 0.5);
  color-scheme: dark;
}

/* Tailwind v4: expose the tokens as utilities (bg-paper, text-ink-2, border-line, ...). */
@theme inline {
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-sunk: var(--sunk);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-line: var(--line);
  --color-line-2: var(--line-2);
  --color-brand: var(--brand);
  --color-brand-hover: var(--brand-hover);
  --color-brand-tint: var(--brand-tint);
  --color-brand-on: var(--brand-on);
  --color-tile: var(--tile);
  --color-tile-empty: var(--tile-empty);
  --color-block: var(--block);
  --color-block-bg: var(--block-bg);
  --color-block-on: var(--block-on);
  --color-review: var(--review);
  --color-review-bg: var(--review-bg);
  --color-warn: var(--warn);
  --color-warn-bg: var(--warn-bg);
  --color-info: var(--info);
  --color-info-bg: var(--info-bg);
  --color-focus: var(--focus);
  --color-overlay: var(--overlay);
  --font-sans: var(--font-body);
  --radius-sm: var(--r-sm);
  --radius-md: var(--r-md);
  --shadow-pop: var(--sh-pop);
}

/* Type scale (px): 13 caption · 15 body · 17 lead/section · 22 figure · 28 page title · 40 landing hero.
 * Weights: 400 body, 500 nav/labels, 600 controls and emphasis, 700 headings and figures.
 * Every number that lines up in a column uses `tabular-nums` (set on body). */
html { font-family: var(--font-body); font-size: 100%; }
body {
  background: var(--paper);
  color: var(--ink);
  font-size: 15px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
}
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
