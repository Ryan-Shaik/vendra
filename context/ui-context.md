# UI Context

## Theme

Light mode only. The design language is a warm, editorial marketplace — off-white parchment backgrounds, clean white surfaces, and a deep forest green primary with a golden amber accent. The aesthetic is trustworthy and premium without feeling corporate: think a curated boutique, not a big-box store. Every vendor and customer-facing surface should feel open and easy to scan, while the vendor dashboard remains dense and data-forward without visual clutter.

---

## Colors

All components must use these CSS custom property tokens — no hardcoded hex values.

```css
:root {
  /* Backgrounds */
  --bg-base:        #F9F8F6;   /* Page background — warm off-white */
  --bg-surface:     #FFFFFF;   /* Cards, panels, modals */
  --bg-surface-2:   #F2F0EB;   /* Subtle fills, stat cards, table rows */

  /* Text */
  --text-primary:   #1C1C1A;   /* Body copy, headings */
  --text-muted:     #6B6B67;   /* Labels, captions, secondary info */

  /* Accents */
  --accent-primary: #1A6B4A;   /* Primary brand color — deep forest green */
  --accent-warm:    #F7C948;   /* Secondary accent — golden amber (CTAs, highlights) */

  /* Border */
  --border-default: rgba(28, 28, 26, 0.12); /* 0.5px universal border */

  /* Semantic States */
  --state-success:  #1A6B4A;   /* Matches accent-primary intentionally */
  --state-error:    #C0392B;
  --state-warning:  #E07B00;
  --state-info:     #1B5FA8;
}
```

| Role | CSS Variable | Value |
|------|-------------|-------|
| Page background | `--bg-base` | `#F9F8F6` |
| Card / panel surface | `--bg-surface` | `#FFFFFF` |
| Subtle fill / stat card | `--bg-surface-2` | `#F2F0EB` |
| Primary text | `--text-primary` | `#1C1C1A` |
| Muted / secondary text | `--text-muted` | `#6B6B67` |
| Primary brand accent | `--accent-primary` | `#1A6B4A` |
| Warm secondary accent | `--accent-warm` | `#F7C948` |
| Default border | `--border-default` | `rgba(28,28,26,0.12)` |
| Error | `--state-error` | `#C0392B` |
| Warning | `--state-warning` | `#E07B00` |
| Info | `--state-info` | `#1B5FA8` |
| Success | `--state-success` | `#1A6B4A` |

### Color Usage Rules

- `--accent-primary` (green) is used for primary buttons, active states, links, prices, and all interactive affordances.
- `--accent-warm` (amber) is used for secondary CTAs ("Boost Listing"), star ratings, sale badges, and promotional highlights — never for primary navigation or destructive actions.
- `--bg-surface-2` is used for vendor stat cards, table row alternates, and input placeholders. Never as a page background.
- Semantic state colors (`--state-error`, `--state-warning`, `--state-info`) are used exclusively for status badges, form validation, and system alerts — never as decorative colors.

---

## Typography

| Role | Font | Variable | Usage |
|------|------|----------|-------|
| Display / headings | Playfair Display | `--font-display` | Hero headlines, store names, page titles, section headings |
| UI text / body | DM Sans | `--font-sans` | Navigation, buttons, labels, body copy, dashboard data |
| Code / mono | DM Mono | `--font-mono` | Order IDs, vendor IDs, API keys, technical values |

```css
--font-display: 'Playfair Display', Georgia, serif;
--font-sans:    'DM Sans', 'Helvetica Neue', sans-serif;
--font-mono:    'DM Mono', 'Courier New', monospace;
```

### Type Scale

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| Hero heading (H1) | Playfair Display | 40px | 700 | 1.15 |
| Page title (H2) | Playfair Display | 28px | 600 | 1.2 |
| Section heading (H3) | Playfair Display | 22px | 600 | 1.25 |
| UI heading (H4) | DM Sans | 16px | 600 | 1.3 |
| Body copy | DM Sans | 14px | 400 | 1.65 |
| UI label / caption | DM Sans | 12px | 500 | 1.4 |
| Overline / eyebrow | DM Sans | 11px | 600 | 1.4 |
| Code / ID | DM Mono | 12px | 400 | 1.5 |

### Typography Rules

- `--font-display` (Playfair Display) is used only for headings and vendor store names — never for UI labels, buttons, or data.
- `--font-sans` (DM Sans) is the default for all interactive UI elements, data tables, and body copy.
- Overline/eyebrow text (e.g. section labels like "VENDOR MANAGEMENT") uses DM Sans 11px, weight 600, letter-spacing 0.08em, all caps.
- Price display uses DM Sans 700 + `--accent-primary` color. Crossed-out original prices use `--text-muted` + `text-decoration: line-through`.

---

## Border Radius

All radius values use Tailwind classes mapped to the following scale. Do not use arbitrary `rounded-[Npx]` values.

| Context | Class | Value | Usage |
|---------|-------|-------|-------|
| Badges, chips, inline tags | `rounded` | 6px | Status badges, category tags, small UI chips |
| Inputs, buttons | `rounded-lg` | 10px | All form inputs, standard buttons |
| Cards, panels, dropdowns | `rounded-xl` | 14px | Product cards, vendor cards, info panels, dropdown menus |
| Modals, sheets, drawers | `rounded-2xl` | 20px | Checkout modal, vendor onboarding sheet, overlays |
| Category pills, avatar circles | `rounded-full` | 9999px | Pill-style category filters, user/vendor avatars |

---

## Component Library

Shadcn/UI on top of Tailwind CSS. All base components live in `components/ui/`. Add new Shadcn components via the CLI:

```bash
npx shadcn-ui@latest add [component-name]
```

**Rules:**
- Never rebuild a component that Shadcn already provides.
- Extend Shadcn components via `className` prop overrides — never by editing files inside `components/ui/` directly.
- Custom composite components (e.g. `ProductCard`, `VendorBadge`, `OrderStatusRow`) live in `components/marketplace/` or `components/vendor/` and compose Shadcn primitives.
- All Shadcn component color overrides must use the CSS variables defined above — never hardcoded hex values in component files.

---

## Layout Patterns

### Storefront (Customer-facing)

- **Page shell**: `--bg-base` page background. Sticky top navbar with `--bg-surface` and `border-bottom: 0.5px solid var(--border-default)`.
- **Product listing grid**: Responsive — 2 columns on mobile, 3 on tablet, 4 on desktop. `gap-4` between cards.
- **Product detail page**: Two-column split — image gallery left (60%), product info right (40%). Collapses to single column on mobile.
- **Cart & checkout**: Right-side drawer (cart), full-page checkout with order summary panel on the right.
- **Vendor store page**: Full-width hero banner → vendor info strip → product grid below.

### Vendor Portal

- **Shell**: Fixed left sidebar (240px wide) with `--bg-surface` background and `border-right: 0.5px solid var(--border-default)`. Main content area uses `--bg-base`.
- **Dashboard**: 4-column stat card grid at top, followed by orders table and charts below.
- **Data tables**: Full-width, alternating row fill using `--bg-surface-2`. Sticky header row.
- **Sidebar navigation**: Icon + label pairs. Active state: `--accent-primary` left border (3px) + `--bg-surface-2` row background.

### Admin Panel

- **Same sidebar shell as vendor portal**, distinguished by `--accent-primary` sidebar background with white icons and labels.
- **Two-panel layout** for approval workflows: list on left, detail view on right.

### Global Patterns

- **Modals**: Centered overlay with `backdrop-blur-sm` + `rgba(0,0,0,0.35)` scrim. Modal card uses `--bg-surface` + `rounded-2xl`. Max width 560px for standard, 720px for complex flows.
- **Toast notifications**: Bottom-right anchored. Success uses `--state-success`, error uses `--state-error`. Auto-dismiss at 4s.
- **Empty states**: Centered illustration (SVG) + heading + CTA button. Never show a blank table.
- **Loading states**: Skeleton shimmer using `--bg-surface-2` animated with `animate-pulse`. Never use spinners for layout-level loading.

---

## Icons

Lucide React. Stroke-based icons only — no filled variants.

```tsx
import { ShoppingCart, Store, Package } from 'lucide-react';
```

| Context | Size | Tailwind Class |
|---------|------|---------------|
| Inline with text | 16px | `h-4 w-4` |
| Buttons | 16px | `h-4 w-4` |
| Navigation sidebar | 20px | `h-5 w-5` |
| Feature icons (cards, empty states) | 24px | `h-6 w-6` |
| Hero / decorative | 32px | `h-8 w-8` |

**Rules:**
- Icons in buttons always have a `gap-2` between icon and label text.
- Standalone icon buttons must have an `aria-label` attribute.
- Decorative icons (not conveying information) use `aria-hidden="true"`.
- Icon color always inherits from the parent's text color — never set icon color independently unless creating an intentional accent.
- Stroke width: `strokeWidth={1.5}` for decorative/hero icons. Default `strokeWidth={2}` everywhere else.

---

## Spacing System

Use Tailwind's spacing scale exclusively. Common rhythm values:

| Usage | Value |
|-------|-------|
| Between inline elements (icon + label) | `gap-2` (8px) |
| Between stacked form fields | `gap-3` (12px) |
| Between card sections | `gap-4` (16px) |
| Between page sections | `gap-8` (32px) |
| Page horizontal padding | `px-6` desktop, `px-4` mobile |
| Page vertical padding | `py-10` |
| Card internal padding | `p-4` small, `p-5` standard, `p-6` large |

---

## Motion

All animations must respect `prefers-reduced-motion`. Wrap animations in:

```css
@media (prefers-reduced-motion: no-preference) {
  /* animation definitions here */
}
```

| Pattern | Duration | Easing |
|---------|----------|--------|
| Hover state transitions | 150ms | `ease-out` |
| Modal open/close | 200ms | `ease-in-out` |
| Toast slide-in | 250ms | `spring` (via Framer Motion) |
| Page transitions | 300ms | `ease-in-out` |
| Skeleton shimmer | 1.5s loop | `ease-in-out` |

Use Framer Motion for component-level animations (modal enter/exit, cart drawer, page transitions). CSS transitions are sufficient for hover and focus states.
