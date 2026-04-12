# Xerow AI — Design System

> **For AI agents**: Read this file BEFORE making any UI changes. Follow every rule below.
> If a rule conflicts with a user request, mention the conflict and ask for clarification.

## Overview

Xerow AI is an industrial monitoring & escalation platform for oil & gas operations. The design system prioritizes operator safety, 12-hour shift readability, and ISA-101 compliance.

---

## Typography

### Font

**Manrope** — Variable weight (200–800), loaded via Google Fonts.

```css
--font-sans: 'Manrope', system-ui, sans-serif;
--font-mono: JetBrains Mono, monospace;
```

**Rules:**
- ALL text uses Manrope. Never introduce a second sans-serif font.
- Headings use `font-weight: 700` with `letter-spacing: -0.02em` (tight tracking)
- Body text uses `font-weight: 400`
- Labels and badges use `font-weight: 500` or `600`
- Sensor values, timestamps, and tabular data use `--font-mono` (JetBrains Mono)
- Apply `-webkit-font-smoothing: antialiased` globally

### Responsive Font Size

Base font uses CSS `clamp()` for fluid scaling:

```css
html { font-size: clamp(0.875rem, 0.8rem + 0.25vw, 1rem); }
```

This gives **14px on mobile → 16px on desktop** automatically. All `rem` values scale with it.

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Badges, timestamps, metadata |
| `text-sm` | 14px | Table cells, secondary labels |
| `text-base` | 16px | Body text, form inputs |
| `text-lg` | 18px | Section headers, card titles |
| `text-xl` | 20px | Page titles |
| `text-2xl` | 24px | Hero text, large KPI values |
| `text-3xl` | 30px | Dashboard hero numbers |

**Never use `text-[11px]` or arbitrary pixel values for body text.** Use the scale above.

---

## Color System

All colors use OKLCH. Defined in `apps/web/src/styles/theme.css`.

### Brand Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--primary` | `oklch(0.6716 0.1368 48.5130)` | `oklch(0.7214 0.1337 49.9802)` | Warm amber — CTAs, active states, send button |
| `--secondary` | `oklch(0.5360 0.0398 196.0280)` | `oklch(0.5940 0.0443 196.0233)` | Cool teal — secondary actions |
| `--brand-green` | `oklch(0.72 0.19 155)` | same | Sidebar active nav item |

### Severity Colors (ISA-18.2 Aligned)

| Level | Token | Hex Approx | When to Use |
|-------|-------|-----------|-------------|
| Green | `--severity-green` | `#22c55e` | Deviation ≤5%, logged only, no ticket |
| Amber | `--severity-amber` | `#f59e0b` | Deviation 5-15%, ticket assigned to Tom |
| Red | `--severity-red` | `#ef4444` | Deviation >15%, immediate attention |
| Purple | `--severity-purple` | `#a855f7` | Unclassifiable, Harry paged immediately |

**Rules:**
- Never use severity colors for decoration. Only for actual severity states.
- Each severity has a `-bg` variant at 12-15% opacity for card backgrounds.
- Always pair severity color with a text label — never color-only.

### Dark Mode

Default theme. Background: `oklch(0.1797 0.0043 308.1928)` — warm dark gray (not pure black, per ISA-101).

### Switching Themes

The `dark` class is added to `<html>` on mount. To change: edit `AppLayout.tsx` line that calls `document.documentElement.classList.add('dark')`.

---

## Spacing

4px base (`--spacing: 0.25rem`). Use Tailwind classes:

| Class | Value | Usage |
|-------|-------|-------|
| `gap-1` / `p-1` | 4px | Tight spacing within components |
| `gap-2` / `p-2` | 8px | Default internal padding |
| `gap-3` / `p-3` | 12px | Card content padding |
| `gap-4` / `p-4` | 16px | Section spacing |
| `gap-5` / `p-5` | 20px | Page padding (standard) |
| `gap-6` / `p-6` | 24px | Large section gaps |

**Rule:** All page containers use `p-5`. All card internals use `p-4` or `p-5`.

---

## Border Radius

Base: `--radius: 0.75rem` (12px)

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-md` | 10px | Inputs, small badges |
| `rounded-lg` | 12px | Cards, buttons, dialogs |
| `rounded-xl` | 16px | Large cards, modals |
| `rounded-2xl` | 20px | Asset cards, tool widgets, sign-in card |

---

## Shadows

Subtle with 5% opacity. Heavy shadows look wrong on dark backgrounds.

---

## Components

### Thread / Chat Container

- Has `border-l border-border/40` to separate from sidebar
- Content max-width: `--thread-max-width: 44rem`
- Empty state is vertically + horizontally centered
- Composer is pinned outside the scroll viewport (sticky bottom)

### Cards (Asset / Ticket)

```
┌─────────────────────────────┐
│ [Icon 12w×12h rounded-xl]   │  ← "View ↗" on hover (top-right)
│                             │
│ Title (text-sm font-bold)   │
│ Subtitle (text-xs muted)    │
│ Timestamp (text-[10px])     │
│                             │
│ [badge] [badge] [badge]     │  ← severity, status, SLA
└─────────────────────────────┘
```

- `rounded-2xl`, `bg-card`, `border border-border/40`
- Icon top-left in colored `rounded-xl` container
- Left-aligned text
- Badge row at bottom with `gap-1`
- Hover: `hover:border-border/80 hover:shadow-lg`
- Grid: `grid-cols-2 sm:grid-cols-3 gap-3`

### Tables

- Shadcn `Table` component
- Row height: default on desktop, 44px+ on mobile
- First column: severity badge
- Last column: SLA timer (hidden when breached)
- Checkbox column for batch actions

### Charts

- Shadcn `ChartContainer` + `ChartConfig` wrapper
- Area chart with gradient fill (25% → 2% opacity)
- Baseline: dashed reference line
- Anomaly markers: `ReferenceDot` with severity color, 7px radius
- Comparison: dashed gray line at 50% opacity
- Drag-select: amber overlay for manual range selection

### Sidebar (Claude.ai Pattern)

- Width: 18rem expanded, icon-only collapsed
- Nav items: flat `h-8` buttons with icon + text
- "Recents" section for chat history
- User avatar with initials at bottom
- Collapsed: logo swaps to expand button on hover

### StatsDisplay (tool-ui)

Used for KPI grids in tool widgets and dashboard. Supports:
- Delta indicators (green up / red down)
- Sparkline trends
- Locale-aware number formatting

---

## Accessibility

| Rule | Standard |
|------|----------|
| Touch targets | Min 44×44px (`.touch-target` utility) |
| Color contrast | 4.5:1 AA minimum for all text |
| Color-only info | Never — always pair with text/icon |
| Focus rings | Visible on all interactive elements |
| Reduced motion | Respect `prefers-reduced-motion` |
| Font scaling | `clamp()` base ensures readability at all sizes |

---

## File Locations

| What | Path |
|------|------|
| Theme (all CSS vars) | `apps/web/src/styles/theme.css` |
| Font import | `apps/web/src/styles/fonts.css` |
| Tailwind config | `apps/web/src/styles/tailwind.css` |
| Main CSS entry | `apps/web/src/styles/index.css` |
| Sidebar | `apps/web/src/app/components/AppSidebar.tsx` |
| Chat thread | `apps/web/src/app/components/assistant-ui/thread.tsx` |
| Chat adapter | `apps/web/src/lib/assistant-ui-adapter.ts` |
| API config | `apps/web/src/lib/config.ts` |
| Tool widgets | `apps/web/src/components/tool-ui/widgets/` |
| Pages | `apps/web/src/app/pages/` |
| Router | `apps/web/src/app/router.tsx` |
| Layout (auth gate) | `apps/web/src/app/layouts/AppLayout.tsx` |

---

## Deployment

| Service | Platform | Domain |
|---------|----------|--------|
| Frontend | Netlify | xerow.io / xerow-ai.netlify.app |
| Backend | Railway | xerow-ai-production.up.railway.app |
| Agent | Railway | xerow-agent-production.up.railway.app |
| Database | Railway PostgreSQL | Internal |
| Cache | Railway Redis | Internal |

---

## Rules for AI Agents Making UI Changes

1. **Read this file first** before modifying any UI component.
2. **Use Manrope** for all text. Never add a second sans-serif.
3. **Use semantic color tokens** (`text-foreground`, `bg-card`, `text-severity-red`). Never hardcode hex/oklch in components.
4. **Follow the card pattern** for all tool widgets — icon top-left, title left-aligned, badges at bottom.
5. **Use `text-sm`/`text-xs`/`text-base`** from the type scale. Avoid arbitrary sizes like `text-[11px]`.
6. **All new pages** must use `p-5` padding and include `<LastUpdated>` if showing data.
7. **All new tables** must be responsive (larger rows on mobile) and support keyboard navigation.
8. **All severity displays** must include both color AND text label.
9. **Dark mode is default.** Test all changes in dark mode first.
10. **Commit message prefix:** `feat:` for new features, `fix:` for bug fixes, `style:` for pure visual changes.
