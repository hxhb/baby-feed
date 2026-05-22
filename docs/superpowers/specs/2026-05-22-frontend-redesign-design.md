# Frontend Redesign Design Spec

**Date:** 2026-05-22
**Status:** Approved
**Scope:** UI/UX redesign only — no database, API, or middleware changes

## Goal

Redesign the Baby Feed application's frontend design language and visual style to achieve:
- Unified modern look across all pages
- Cohesive, vibrant color scheme with warmth
- New PWA icon and splash screen
- Zero impact on data layer (Prisma schema, API routes, auth middleware)

## Design Direction

**Style:** Modern and lively (现代活泼)
**Tone:** Fresh sky-blue with vibrant accent colors
**Feel:** Bright gradients, large rounded corners (20px), lively transitions

## Color System

### Primary Brand Gradient (page-level)
- **From:** Blue 500 `#3b82f6`
- **To:** Cyan 500 `#06b6d4`
- **Usage:** FAB button, primary action buttons, highlight cards, active navigation indicators

### PWA Icon Gradient
- **From:** Blue 500 `#3b82f6`
- **To:** Pink 400 `#f472b6`
- **Usage:** App icon only (independent brand mark, warmer than page gradient)

### Background Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-page` | `#f0f9ff` | Page background (replaces current `#f9fafb`) |
| `--bg-card` | `#ffffff` | Card surfaces |
| `--bg-secondary` | `#f1f5f9` | Secondary containers, input backgrounds |

### Text Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#0f172a` | Headings, primary text (slate-900) |
| `--text-secondary` | `#475569` | Body text, descriptions (slate-600) |
| `--text-muted` | `#94a3b8` | Disabled, placeholder text (slate-400) |

### Functional Accent Colors (each category has its own gradient)
| Category | Gradient | Background tint |
|----------|----------|-----------------|
| 母乳 (Breast milk) | `#f472b6` → `#ec4899` | `#fdf2f8` → `#fce7f3` |
| 奶粉 (Formula) | `#60a5fa` → `#3b82f6` | `#eff6ff` → `#dbeafe` |
| AD 滴剂 (Vitamin AD) | `#fb923c` → `#f97316` | `#fff7ed` → `#ffedd5` |
| 健康 (Health) | `#34d399` → `#10b981` | `#f0fdf4` → `#dcfce7` |
| 睡眠 (Sleep) | `#a78bfa` → `#8b5cf6` | `#f5f3ff` → `#ede9fe` |
| 尿布 (Diaper) | `#fbbf24` → `#f59e0b` | `#fffbeb` → `#fef3c7` |

### Shadow System
- **Card shadow:** `0 2px 16px rgba(59, 130, 246, 0.08)` (blue-tinted, soft)
- **Elevated shadow (FAB, modals):** `0 4px 20px rgba(59, 130, 246, 0.25)`
- **Pressed state:** `0 1px 4px rgba(59, 130, 246, 0.12)`

## Component Specifications

### Cards
- Border radius: `20px`
- Background: white
- Shadow: blue-tinted (`rgba(59,130,246,0.08)`)
- Border: `1px solid rgba(59,130,246,0.06)` (subtle)
- **Highlight variant:** gradient background (primary gradient), white text, stronger shadow

### Quick Action Buttons
- Grid layout: 4 columns
- Each button: vertical stack (icon container + label)
- Icon container: `36×36px`, `border-radius: 12px`, category gradient fill, white icon
- Container shadow: `0 2px 8px` with category color at 30% opacity
- Background: vertical gradient of category tint colors
- Border: `1px solid` category color at 10% opacity
- Label: `11px`, `font-weight: 600`, category dark color

### Bottom Navigation (Mobile)
- **Style:** Pill indicator
- Background: white, `border-radius: 28px 28px 0 0` (top corners rounded)
- Shadow: `0 -2px 20px rgba(0,0,0,0.06)`
- **Active item:** pill-shaped background (`border-radius: 15px`, blue-50 gradient), filled icon in blue-600, bold label in blue-600
- **Inactive item:** line icon in slate-400, regular label in slate-400
- **Center FAB:** `52×52px`, `border-radius: 16px`, primary gradient, white plus icon, elevated shadow, floats above the bar (negative margin-top)

### Desktop Navigation
- Sticky top, white background, subtle border-bottom
- Active item: blue-50 background pill, blue-600 text and filled icon
- Inactive: gray-600 text, line icons

### Typography
| Element | Size | Weight | Tracking |
|---------|------|--------|----------|
| Page numbers/stats | 28-32px | 800 | -0.5px |
| Section headings | 16px | 700 | normal |
| Body text | 14px | 400 | normal |
| Labels/captions | 12px | 500 | normal |
| Tiny labels | 11px | 600 | normal |
| Nav labels | 10-11px | 600 | normal |

### Transitions & Animation
- Default transition: `200ms ease`
- Active/press state: `transform: scale(0.95)` with spring easing
- Page transitions: subtle fade-in (200ms)
- Loading spinner: gradient-colored (not plain gray)

## PWA Assets

### App Icon
- **Shape:** Rounded square (iOS superellipse) with `border-radius: 22-24px` proportional
- **Background:** Linear gradient 135deg from `#3b82f6` (blue) to `#f472b6` (pink)
- **Foreground:** White stylized baby bottle
  - Large rounded rectangle body (rx=8)
  - Wider bottle neck (rx=5)
  - Smooth nipple arc on top
  - Milk fill in lower 55% with translucent category color (pink at 25% opacity)
  - Heart shape centered in milk area (blue at 50% opacity)
- **Fill ratio:** Bottle occupies ~75% of icon area (minimal whitespace)
- **Sizes to generate:** 72, 96, 128, 144, 152, 192, 384, 512 (all SVG)
- **Maskable variant:** Same design with extra padding (safe zone compliance)

### Splash Screen
- **Background:** Vertical gradient from `#f0f9ff` (top) through `#e0f2fe` to `#bae6fd` (bottom)
- **Decorative elements:** 2-3 large translucent circles (blue/cyan at 6-8% opacity) positioned off-screen partially
- **Content (centered):**
  - App icon: `80×80px` with elevated shadow
  - App name: "Baby Feed" in 22px, weight 800, color slate-900
  - Subtitle: "宝宝喂养记录" in 13px, color slate-600
- **Animation:** Fade-in on load (CSS-only, no JS dependency)
- **Implementation:** CSS-based splash that displays while the app shell loads, dismissed when React hydrates

### Manifest Updates
- `theme_color`: `#3b82f6` (keep blue as browser chrome color)
- `background_color`: `#f0f9ff` (match new page background)

## Page-Specific Adjustments

### Dashboard (/)
- Baby info card: gradient avatar background (pink-100 to blue-100 → keep but intensify)
- Stats grid: each stat card gets its category gradient icon container
- Quick actions: new gradient button style as specified
- Today's records: `bg-gray-50` list items → subtle category-tinted left border accent

### Timeline (/timeline)
- Date headers: slightly bolder, use primary text color
- Record items: keep list layout, add category color left border
- Delete/Edit actions: subtle, appear on hover/long-press

### Stats (/stats)
- Chart cards: white rounded cards with blue-tinted shadow
- Segment tabs: pill style (active = primary gradient text + underline)

### Settings (/settings)
- Section cards: standard white cards with 20px radius
- Action buttons: consistent with new button styles
- Danger actions (delete): red-50 background, red-600 text

### Add Record (/add)
- Form inputs: `border-radius: 12px`, subtle border, focus ring in primary color
- Submit button: primary gradient, white text, elevated shadow
- Type selector: horizontal pills with category colors

## Files to Modify

### Must change:
- `app/globals.css` — CSS custom properties, background, shadow utilities
- `tailwind.config.ts` — extended color palette, border-radius defaults
- `components/Dashboard.tsx` — card styles, quick actions, stat cards
- `components/Navbar.tsx` — pill indicator, FAB, active state
- `components/Stats.tsx` — chart containers, tabs
- `components/Timeline.tsx` — record items, date headers
- `components/Settings.tsx` — section cards, buttons
- `components/FeedingForm.tsx` — form inputs, type selector, submit button
- `components/HealthForm.tsx` — same form style updates
- `components/StatsUi.tsx` — chart panel styles
- `components/MemoSection.tsx` — card styles
- `public/icon.svg` — new icon design
- `public/icons/*` — regenerate all size variants
- `public/manifest.json` — update theme_color, background_color
- `app/layout.tsx` — update viewport themeColor, add splash screen logic

### Must NOT change:
- `prisma/` — database schema and migrations
- `app/api/` — all API route handlers
- `lib/auth.ts` — authentication logic
- `lib/api-key.ts` — API key validation
- `lib/validation.ts` — input validation
- `lib/rate-limit.ts` — rate limiting
- `middleware.ts` — route protection
- `lib/server-*.ts` — server-side data fetching (data layer, not presentation)
- `scripts/` — migration and admin scripts

## Design Tokens (Tailwind Config)

```typescript
// tailwind.config.ts additions
theme: {
  extend: {
    colors: {
      brand: {
        50: '#f0f9ff',
        100: '#e0f2fe',
        500: '#3b82f6',
        600: '#2563eb',
      },
      accent: {
        breast: '#ec4899',
        formula: '#3b82f6',
        ad: '#f97316',
        health: '#10b981',
        sleep: '#8b5cf6',
        diaper: '#f59e0b',
      },
    },
    borderRadius: {
      'card': '20px',
      'button': '16px',
      'element': '12px',
    },
    boxShadow: {
      'card': '0 2px 16px rgba(59, 130, 246, 0.08)',
      'elevated': '0 4px 20px rgba(59, 130, 246, 0.25)',
      'pressed': '0 1px 4px rgba(59, 130, 246, 0.12)',
    },
  },
},
```

## Constraints

1. **Light mode only** — the app forces light mode; no dark mode support needed
2. **Mobile-first** — all designs optimized for 375px+ width, graceful desktop scaling
3. **Performance** — no heavy animation libraries; CSS transitions only
4. **Accessibility** — maintain WCAG AA contrast ratios (all text colors verified against backgrounds)
5. **No new dependencies** — achieve everything with Tailwind CSS classes and inline SVG
6. **Safe area** — continue respecting `env(safe-area-inset-*)` for notch/home-indicator devices
