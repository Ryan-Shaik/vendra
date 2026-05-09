# Spec: Design System & UI Primitives

> Read `AGENTS.md` before starting.
> This spec applies to `apps/marketplace` first.
> `apps/admin` gets its own design system spec separately — do not set it up here.

---

## Overview

Install and configure the full design system foundation for `apps/marketplace`:
PostCSS → Tailwind v4 → fonts → `globals.css` with `@theme inline` → Shadcn/UI init → component installation → `cn()` helper.

Every step must be completed in order. Do not skip ahead.

> **Tailwind v4 is fundamentally different from v3.**
> There is no `tailwind.config.ts`. All theme configuration — colors, fonts, border radius, custom tokens — lives in `globals.css` using the `@theme` directive.
> Do not create a `tailwind.config.ts` file. Do not use `@tailwind base/components/utilities` directives. Do not install `tailwindcss-animate`.

---

## Step 1 — Install Tailwind v4 and PostCSS

Run from `apps/marketplace`:

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

Create `apps/marketplace/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

> **Do not** use the old PostCSS plugin name `tailwindcss` — that is the v3 plugin. v4 uses `@tailwindcss/postcss`.

---

## Step 2 — Install remaining dependencies

```bash
# Animation — replaces tailwindcss-animate (deprecated in v4)
npm install tw-animate-css

# cn() helper dependencies
npm install clsx tailwind-merge

# Icons
npm install lucide-react

# Framer Motion — required for modal/drawer/page animations per ui-context.md
npm install framer-motion
```

> Do **not** install `tailwindcss-animate` — it is deprecated for Tailwind v4. Use `tw-animate-css` instead, imported directly in `globals.css`.
> Fonts are loaded via `next/font/google` — no npm install needed.

---

## Step 3 — Set up fonts in `layout.tsx`

In `apps/marketplace/app/layout.tsx`, load the three fonts using `next/font/google` and apply them as CSS variables on the `<html>` element. Do this before writing `globals.css` so the variables are defined when the CSS runs.

```tsx
import { Playfair_Display, DM_Sans, DM_Mono } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: '400',
})

// Apply all three as CSS variables on <html>:
// <html className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}>
```

> Do not use `@import url(...)` in CSS for fonts — `next/font` handles optimised loading and prevents layout shift.

---

## Step 4 — Write `globals.css`

Create `apps/marketplace/app/globals.css`. This file does not exist yet — write it from scratch. It is the single source of truth for the entire design system in Tailwind v4.

Write the file in this exact order:

### 4a — Import Tailwind and animation library

```css
@import "tailwindcss";
@import "tw-animate-css";
```

> In v4, `@import "tailwindcss"` replaces all three v3 directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`). Use only this single import.

### 4b — Project design tokens (`:root`)

Define all custom tokens from `ui-context.md`:

```css
:root {
  /* Backgrounds */
  --bg-base:        #F9F8F6;
  --bg-surface:     #FFFFFF;
  --bg-surface-2:   #F2F0EB;

  /* Text */
  --text-primary:   #1C1C1A;
  --text-muted:     #6B6B67;

  /* Accents */
  --accent-primary: #1A6B4A;
  --accent-warm:    #F7C948;

  /* Border */
  --border-default: rgba(28, 28, 26, 0.12);

  /* Semantic states */
  --state-success:  #1A6B4A;
  --state-error:    #C0392B;
  --state-warning:  #E07B00;
  --state-info:     #1B5FA8;
}
```

### 4c — Shadcn/UI CSS variable mapping (`:root`)

Shadcn components reference their own variable names (`--primary`, `--background`, etc.).
Map them to the project tokens so Shadcn renders with the correct theme:

```css
:root {
  --background:             var(--bg-base);
  --foreground:             var(--text-primary);
  --card:                   var(--bg-surface);
  --card-foreground:        var(--text-primary);
  --popover:                var(--bg-surface);
  --popover-foreground:     var(--text-primary);
  --primary:                var(--accent-primary);
  --primary-foreground:     #FFFFFF;
  --secondary:              var(--bg-surface-2);
  --secondary-foreground:   var(--text-primary);
  --muted:                  var(--bg-surface-2);
  --muted-foreground:       var(--text-muted);
  --accent:                 var(--accent-warm);
  --accent-foreground:      var(--text-primary);
  --destructive:            var(--state-error);
  --destructive-foreground: #FFFFFF;
  --border:                 var(--border-default);
  --input:                  var(--border-default);
  --ring:                   var(--accent-primary);
  --radius:                 10px;
}
```

### 4d — `@theme inline` block

In Tailwind v4, CSS variables are **not** automatically available as utility classes. They must be explicitly exposed using `@theme inline`. This block replaces the entire `theme.extend` section of `tailwind.config.ts` from v3.

```css
@theme inline {
  /* Project color tokens → Tailwind utility classes
     --color-X → bg-X, text-X, border-X, ring-X utilities */
  --color-bg-base:              var(--bg-base);
  --color-bg-surface:           var(--bg-surface);
  --color-bg-surface-2:         var(--bg-surface-2);
  --color-text-primary:         var(--text-primary);
  --color-text-muted:           var(--text-muted);
  --color-accent-primary:       var(--accent-primary);
  --color-accent-warm:          var(--accent-warm);
  --color-state-success:        var(--state-success);
  --color-state-error:          var(--state-error);
  --color-state-warning:        var(--state-warning);
  --color-state-info:           var(--state-info);

  /* Shadcn color tokens → utilities used inside components/ui/* */
  --color-background:           var(--background);
  --color-foreground:           var(--foreground);
  --color-card:                 var(--card);
  --color-card-foreground:      var(--card-foreground);
  --color-popover:              var(--popover);
  --color-popover-foreground:   var(--popover-foreground);
  --color-primary:              var(--primary);
  --color-primary-foreground:   var(--primary-foreground);
  --color-secondary:            var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted:                var(--muted);
  --color-muted-foreground:     var(--muted-foreground);
  --color-accent:               var(--accent);
  --color-accent-foreground:    var(--accent-foreground);
  --color-destructive:          var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border:               var(--border);
  --color-input:                var(--input);
  --color-ring:                 var(--ring);

  /* Typography → font-display, font-sans, font-mono utilities */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-sans:    'DM Sans', 'Helvetica Neue', sans-serif;
  --font-mono:    'DM Mono', 'Courier New', monospace;

  /* Border radius scale — maps to rounded-sm, rounded-md, rounded-lg, rounded-xl */
  --radius-sm: 6px;   /* badges, chips, inline tags */
  --radius-md: 10px;  /* inputs, buttons */
  --radius-lg: 14px;  /* cards, panels, dropdowns */
  --radius-xl: 20px;  /* modals, sheets, drawers */
}
```

> **Why `@theme inline`?**
> - `@theme` creates new utility classes from scratch (overrides defaults)
> - `@theme inline` maps existing CSS variables to Tailwind utilities without removing Tailwind's default palette
> - Use `@theme inline` here so the project tokens are additive — Tailwind's built-in utilities remain available alongside the custom ones
> - Naming convention: `--color-X` inside `@theme inline` generates `bg-X`, `text-X`, and `border-X` classes. So `--color-accent-primary` → `bg-accent-primary`, `text-accent-primary`, `border-accent-primary`.

### 4e — Base layer styles

```css
@layer base {
  body {
    background-color: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-sans);
  }

  h1, h2, h3 {
    font-family: var(--font-display);
  }

  /*
    Tailwind v4 changed the default border color to currentColor.
    This restores consistent border rendering across all components —
    matching the behaviour components were designed against.
  */
  *, ::after, ::before, ::backdrop, ::file-selector-button {
    border-color: var(--border-default);
  }
}
```

### 4f — Motion accessibility

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Step 5 — Initialise Shadcn/UI

Run from `apps/marketplace`:

```bash
npx shadcn@latest init
```

When prompted, use these exact settings:

| Prompt | Answer |
|--------|--------|
| Style | `new-york` |
| Base color | `neutral` |
| CSS variables | `yes` |
| `globals.css` location | `app/globals.css` |
| Tailwind config location | *(leave blank — v4 has no config file)* |
| Components alias | `@/components` |
| Utils alias | `@/lib/utils` |

After init, verify `components.json`:
- `"cssVariables": true`
- `"config": ""` — must be an **empty string**. A path here tells Shadcn to use a v3 config file, which breaks v4.

> Shadcn init may overwrite parts of `globals.css`. After init, compare the file against the content written in Step 4. Restore any overwritten project tokens and the `@theme inline` block if needed. Keep any additional Shadcn tokens it added.

---

## Step 6 — Create `lib/utils.ts`

Create `apps/marketplace/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind CSS classes safely, resolving conflicts.
 * Uses clsx for conditional logic and tailwind-merge for deduplication.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-accent-primary', className)
 * cn('px-4 px-6') // → 'px-6' (conflict resolved, last wins)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

This is the **only** file that calls `clsx` or `twMerge` directly.
All other files import `cn` from `@/lib/utils`.

---

## Step 7 — Install Shadcn components

Run each from `apps/marketplace`. Install one at a time — verify no console errors before the next:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add tabs
npx shadcn@latest add textarea
npx shadcn@latest add scroll-area
npx shadcn@latest add badge
npx shadcn@latest add separator
npx shadcn@latest add sheet
npx shadcn@latest add table
npx shadcn@latest add select
npx shadcn@latest add sonner
npx shadcn@latest add skeleton
npx shadcn@latest add avatar
npx shadcn@latest add dropdown-menu
```

**Why each component beyond the original 7:**

| Component | Required for |
|-----------|-------------|
| `badge` | Order status, vendor status, product flags throughout the UI |
| `separator` | Dividers in cards, sidebars, settings panels |
| `sheet` | Cart drawer (right-side slide-in per `ui-context.md`) |
| `table` | Vendor order tables, admin reconciliation table, activity log |
| `select` | Category selector, shipping zone, PLP filter selectors |
| `sonner` | Toast notifications — bottom-right, auto-dismiss at 4s per `ui-context.md` |
| `skeleton` | Loading shimmer states per `ui-context.md` — no spinners allowed |
| `avatar` | Vendor/customer avatar circles (`rounded-full`) |
| `dropdown-menu` | Navbar user menu, product action menus |

**Do not modify any file inside `components/ui/` after installation.**
All customisation is via `className` props in composite components only.

---

## Step 8 — Verify theme wiring end to end

1. Open `components/ui/button.tsx` — confirm it uses `bg-primary` (not a hardcoded hex). Since `globals.css` maps `--color-primary → var(--primary) → var(--accent-primary) → #1A6B4A`, the primary button should render forest green automatically.

2. Confirm `globals.css` still contains the full `@theme inline` block from Step 4d. If Shadcn init or a component install overwrote it, restore it.

3. Confirm `postcss.config.mjs` still uses `"@tailwindcss/postcss": {}` and not the old `"tailwindcss": {}` key.

4. Confirm no `tailwind.config.ts` file exists anywhere in `apps/marketplace`.

---

## Checks When Done

All of the following must pass before marking this unit complete in `progress-tracker.md`:

- [ ] `npm run build` passes — zero TypeScript errors, zero warnings
- [ ] All 16 Shadcn components import without error
- [ ] `cn('px-4', false && 'hidden', 'py-2')` → `'px-4 py-2'` (falsy values stripped)
- [ ] `cn('px-4 px-6')` → `'px-6'` (conflict resolved by `tailwind-merge`)
- [ ] Page background renders as `#F9F8F6` — not white, not Shadcn's default gray
- [ ] `<Button>` renders with `#1A6B4A` (forest green) — confirms full token chain works
- [ ] H1 renders in Playfair Display — confirms `next/font` variable is applied
- [ ] Body text renders in DM Sans
- [ ] `bg-accent-primary` applies green — confirms `@theme inline` exposes the token
- [ ] `bg-accent-warm` applies amber — confirms all project tokens are exposed
- [ ] No `tailwind.config.ts` exists in `apps/marketplace`
- [ ] `tailwindcss-animate` is **not** in `package.json`
- [ ] `tw-animate-css` is imported at the top of `globals.css`
- [ ] `components.json` has `"config": ""` (empty string)
- [ ] `progress-tracker.md` Phase 1, unit 1.1 sub-tasks checked off

---

## What Not To Do

| ❌ Wrong (v3) | ✅ Correct (v4) |
|--------------|----------------|
| `npx shadcn-ui@latest` | `npx shadcn@latest` |
| Create `tailwind.config.ts` | No config file — theme lives in `globals.css` |
| `@tailwind base; @tailwind components; @tailwind utilities;` | `@import "tailwindcss";` |
| Plugin: `"tailwindcss": {}` in postcss config | Plugin: `"@tailwindcss/postcss": {}` |
| `npm install tailwindcss-animate` | `npm install tw-animate-css` |
| `theme.extend.colors` in config | `@theme inline { --color-X: ... }` in `globals.css` |
| `theme.extend.fontFamily` in config | `@theme inline { --font-X: ... }` in `globals.css` |
| `theme.extend.borderRadius` in config | `@theme inline { --radius-X: ... }` in `globals.css` |
| `"config": "tailwind.config.ts"` in `components.json` | `"config": ""` (empty string) |
| `@import url(...)` for fonts | `next/font/google` in `layout.tsx` |
| Edit files in `components/ui/` | Extend via `className` props only |
| Call `clsx`/`twMerge` inline | Import `cn` from `@/lib/utils` |