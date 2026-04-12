# Xerow AI — Design System

## Overview

Xerow AI is an industrial monitoring & escalation platform for oil & gas operations. The design system prioritizes operator safety, 12-hour shift readability, and ISA-101 compliance.

## Color System

All colors use the OKLCH color space for perceptual uniformity.

### Brand

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `oklch(0.6716 0.1368 48.5130)` | Warm amber — primary CTAs, active states |
| `--secondary` | `oklch(0.5360 0.0398 196.0280)` | Cool teal — secondary actions |
| `--brand-green` | `oklch(0.72 0.19 155)` | Sidebar active state |

### Severity (ISA-18.2 Aligned)

| Level | Token | Hex Approx | Usage |
|-------|-------|-----------|-------|
| Green | `--severity-green` | `#22c55e` | Minor deviation (<=5%), logged only |
| Amber | `--severity-amber` | `#f59e0b` | Moderate (5-15%), ticket assigned |
| Red | `--severity-red` | `#ef4444` | Significant (>15%), immediate attention |
| Purple | `--severity-purple` | `#a855f7` | Unclassifiable, chief operator paged |

Each severity has a `-bg` variant at 12-15% opacity for card/badge backgrounds.

### Dark Mode

Default theme for control room operations. Background uses `oklch(0.1797 0.0043 308.1928)` — a slightly warm dark gray that reduces eye strain during 12-hour shifts (ISA-101 recommendation: avoid pure black).

### Light Mode

Available but not the default. Background is pure white `oklch(1.0 0 0)`.

## Typography

| Token | Font | Usage |
|-------|------|-------|
| `--font-sans` | Geist Mono, ui-monospace | Body text, UI labels — monospace for data-dense displays |
| `--font-mono` | JetBrains Mono | Code, sensor values, tabular data |
| `--font-serif` | serif | Not used in current design |

### Scale

Base size: 16px (browser default). All sizing uses Tailwind's default scale:
- `text-xs` (12px) — badges, timestamps
- `text-sm` (14px) — table cells, secondary text
- `text-base` (16px) — body text, inputs
- `text-lg` (18px) — section headers
- `text-xl` (20px) — page titles
- `text-2xl` (24px) — hero text, KPI values

## Spacing

4px/8px rhythm using Tailwind's `--spacing: 0.25rem` base:
- `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-5` (20px), `p-6` (24px)
- Component padding: cards use `p-4` or `p-5`
- Page padding: `p-5` on all pages
- Gap between sections: `gap-4` or `gap-5`

## Border Radius

Base: `--radius: 0.75rem` (12px)
- `rounded-sm` (8px) — small elements
- `rounded-md` (10px) — inputs, badges
- `rounded-lg` (12px) — cards, buttons
- `rounded-xl` (16px) — large cards, modals
- `rounded-2xl` (20px) — asset cards, tool widgets

## Shadows

Subtle shadows with 5% opacity. Avoid heavy drop shadows in dark mode.

## Component Patterns

### Cards (Asset/Ticket)
- `rounded-2xl`, `bg-card`, `border border-border/40`
- Icon top-left in colored `rounded-xl` container
- Title + subtitle left-aligned below
- Badge row at bottom (severity, status, metrics)
- "View Details" with `ArrowUpRight` icon on hover (top-right, `opacity-0 group-hover:opacity-100`)

### Tables
- Shadcn `Table` with `data-slot="table"` for responsive overrides
- Row height increases to 44px+ on mobile (<768px) for touch targets
- Severity badges in first column
- SLA timer in last column (hidden when breached)

### Charts (Recharts + Shadcn ChartContainer)
- `ChartContainer` with `ChartConfig` for theme-aware colors
- Area chart with gradient fill (`fillOpacity 0.25 → 0.02`)
- Baseline as dashed reference line
- Anomaly markers as colored `ReferenceDot` (7px radius)
- Drag-select for time range selection (amber overlay)
- Historical comparison as dashed gray line at 50% opacity

### Tool UI Widgets (Chat)
- `StatsDisplay` for KPI grids with sparklines
- `Chart` for severity distribution bars
- Card-based layout matching asset card design
- Skeleton loading with `animate-pulse` during tool execution

## Accessibility

### Touch Targets (ISA-101)
- Minimum 44x44px for all interactive elements
- `.touch-target` utility class available
- Table rows increase padding on mobile

### Color
- Never convey information by color alone — always include text/icon
- Severity uses both color AND text label
- All text meets WCAG AA contrast (4.5:1 minimum)

### Motion
- Animations 150-300ms for micro-interactions
- `animate-pulse` for SLA breach alerts only
- Respect `prefers-reduced-motion`

## Layout

### Sidebar (Claude.ai Pattern)
- Navigation items: flat, `h-8`, icon + text
- "Recents" section for chat history
- Collapsible to icon-only mode
- User avatar with initials at bottom

### Pages
- Max content width: `max-w-2xl` for chat, full-width for dashboards
- Two-column layout on desktop (`lg:grid-cols-2`), single column on mobile
- Sticky composer at bottom of chat (outside scroll viewport)

### Responsive Breakpoints
- `<768px` — Mobile/tablet: single column, bottom nav potential, larger touch targets
- `768px-1024px` — Tablet: sidebar collapses, two-column where appropriate
- `>1024px` — Desktop: full sidebar, multi-column layouts

## Deployment

| Service | Platform | Domain |
|---------|----------|--------|
| Frontend | Netlify | xerow.io / xerow-ai.netlify.app |
| Backend | Railway | xerow-ai-production.up.railway.app |
| Agent | Railway | xerow-agent-production.up.railway.app |
| Database | Railway PostgreSQL | Internal |
| Cache | Railway Redis | Internal |
