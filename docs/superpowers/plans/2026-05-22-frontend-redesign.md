# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Baby Feed's frontend with a unified modern design system (vibrant gradients, large rounded corners, warm PWA icon) without touching any API/DB files.

**Architecture:** Tailwind config defines design tokens. `globals.css` provides CSS custom properties and utility classes. Each component file is updated to use new token-based classes. PWA assets (SVG icons, manifest) regenerated. A CSS-based splash screen is added in the root layout.

**Tech Stack:** Tailwind CSS, Next.js App Router, SVG, CSS custom properties

---

## File Structure

| File | Role |
|------|------|
| `tailwind.config.ts` | Design tokens: colors, border-radius, box-shadow |
| `app/globals.css` | CSS variables, gradient utilities, splash screen styles |
| `app/layout.tsx` | Updated themeColor, splash screen HTML |
| `public/icon.svg` | New app icon (blue→pink bottle) |
| `public/icons/icon-*.svg` | All size variants regenerated |
| `public/manifest.json` | Updated theme_color, background_color |
| `components/Navbar.tsx` | Pill indicator nav, gradient FAB |
| `components/Dashboard.tsx` | New card styles, quick actions, stat cards |
| `components/StatsUi.tsx` | Updated panel/tab styles |
| `components/Stats.tsx` | Chart card wrappers |
| `components/Timeline.tsx` | Category border accents |
| `components/Settings.tsx` | Section card styles |
| `components/FeedingForm.tsx` | Form input styles, type selector |
| `components/HealthForm.tsx` | Form input styles |
| `components/RecordActionBar.tsx` | Gradient submit button |
| `components/MemoSection.tsx` | Card style update |
| `app/login/LoginClient.tsx` | Login page redesign |
| `lib/record-display.tsx` | Icon color classes update |

---

### Task 1: Design Tokens — Tailwind Config & CSS Variables

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Update tailwind.config.ts with design tokens**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
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
        'nav': '0 -2px 20px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 2: Update globals.css — CSS variables and new utilities**

Replace the `:root` block and add gradient/splash utilities. Keep all the existing mobile fixes (form elements, dark mode override, safe area, recharts, etc.) intact — only change the custom property values and add new utility classes at the end:

```css
:root {
  --background: #f0f9ff;
  --foreground: #0f172a;
  color-scheme: light;
}

/* 强制亮色模式，防止系统夜间模式影响 */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #f0f9ff;
    --foreground: #0f172a;
    color-scheme: light;
  }
}
```

Add these utilities after the existing `@layer utilities` block:

```css
/* Design system gradient utilities */
.gradient-primary {
  background: linear-gradient(135deg, #3b82f6, #06b6d4);
}

.gradient-icon {
  background: linear-gradient(135deg, #3b82f6, #f472b6);
}

.gradient-breast {
  background: linear-gradient(135deg, #f472b6, #ec4899);
}

.gradient-formula {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}

.gradient-ad {
  background: linear-gradient(135deg, #fb923c, #f97316);
}

.gradient-health {
  background: linear-gradient(135deg, #34d399, #10b981);
}

.gradient-sleep {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
}

.gradient-diaper {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

/* Splash screen */
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%);
  transition: opacity 0.4s ease, visibility 0.4s ease;
}

.splash-screen.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.splash-logo {
  animation: splash-fade-in 0.6s ease forwards;
}

@keyframes splash-fade-in {
  from { opacity: 0; transform: scale(0.9) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: Build succeeds (no Tailwind or CSS errors)

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: add design system tokens and gradient utilities"
```

---

### Task 2: PWA Icon & Manifest

**Files:**
- Rewrite: `public/icon.svg`
- Rewrite: `public/icons/icon-72x72.svg` through `icon-512x512.svg` and `icon-maskable.svg`
- Modify: `public/manifest.json`

- [ ] **Step 1: Write new icon.svg (32x32 viewBox)**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" ry="7" fill="url(#bg)"/>
  <rect x="10" y="11" width="12" height="16" rx="4" fill="white" opacity="0.95"/>
  <rect x="12" y="6" width="7" height="6" rx="2.5" fill="white" opacity="0.95"/>
  <path d="M13.5 6 Q15.5 3 17.5 6" fill="white" opacity="0.95" stroke="white" stroke-width="0.8"/>
  <rect x="11" y="18" width="10" height="8" rx="3.5" fill="rgba(244,114,182,0.25)"/>
  <path d="M16 20 C15 19 13.5 19.4 13.5 20.5 C13.5 21.6 16 23 16 23 C16 23 18.5 21.6 18.5 20.5 C18.5 19.4 17 19 16 20Z" fill="rgba(59,130,246,0.5)"/>
</svg>
```

- [ ] **Step 2: Generate all icon size variants**

Each file in `public/icons/` uses a 56x56 viewBox SVG with the same design but scaled to fill the declared size. Write the following file (same content for all sizes — SVG scales naturally):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="56" height="56" rx="12" ry="12" fill="url(#bg)"/>
  <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95"/>
  <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95"/>
  <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" stroke-width="1.5"/>
  <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)"/>
  <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)"/>
</svg>
```

Write this content to: `icon-72x72.svg`, `icon-96x96.svg`, `icon-128x128.svg`, `icon-144x144.svg`, `icon-152x152.svg`, `icon-192x192.svg`, `icon-384x384.svg`, `icon-512x512.svg`.

- [ ] **Step 3: Write maskable icon variant**

The maskable icon needs extra padding (safe zone = 80% center area). Use viewBox `0 0 56 56` but shrink the drawing:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#f472b6"/>
    </linearGradient>
  </defs>
  <rect width="56" height="56" fill="url(#bg)"/>
  <rect x="18" y="21" width="18" height="24" rx="6" fill="white" opacity="0.95"/>
  <rect x="22" y="14" width="10" height="8" rx="3.5" fill="white" opacity="0.95"/>
  <path d="M24.5 14 Q27 10 29.5 14" fill="white" opacity="0.95" stroke="white" stroke-width="1.2"/>
  <rect x="19.5" y="32" width="15" height="12" rx="5" fill="rgba(244,114,182,0.25)"/>
  <path d="M27 35 C25.5 33.5 23.5 34.1 23.5 35.5 C23.5 36.9 27 39 27 39 C27 39 30.5 36.9 30.5 35.5 C30.5 34.1 28.5 33.5 27 35Z" fill="rgba(59,130,246,0.5)"/>
</svg>
```

- [ ] **Step 4: Update manifest.json colors**

Change only the `background_color` and `theme_color`:

```json
"background_color": "#f0f9ff",
"theme_color": "#3b82f6"
```

(Keep everything else — name, icons array, display, orientation, etc.)

- [ ] **Step 5: Commit**

```bash
git add public/icon.svg public/icons/ public/manifest.json
git commit -m "feat: redesign PWA icon (blue→pink gradient bottle) and update manifest colors"
```

---

### Task 3: Splash Screen & Layout Updates

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add splash screen HTML and update themeColor**

In `app/layout.tsx`, make these changes:

1. Update `viewport.themeColor` to `"#3b82f6"` (no change needed, already correct)
2. Add splash screen div inside `<body>`, before `<Providers>`:

```tsx
<body
  className={`${geistSans.variable} ${geistMono.variable} antialiased`}
>
  {/* Splash screen — hidden after React hydrates */}
  <div id="splash" className="splash-screen">
    <div className="splash-logo">
      <svg width="80" height="80" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '20px', boxShadow: '0 8px 32px rgba(59,130,246,0.3)' }}>
        <defs>
          <linearGradient id="splash-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#3b82f6' }} />
            <stop offset="100%" style={{ stopColor: '#f472b6' }} />
          </linearGradient>
        </defs>
        <rect width="56" height="56" rx="12" ry="12" fill="url(#splash-bg)" />
        <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95" />
        <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95" />
        <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" strokeWidth="1.5" />
        <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)" />
        <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)" />
      </svg>
    </div>
    <p style={{ marginTop: '20px', fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>Baby Feed</p>
    <p style={{ marginTop: '4px', fontSize: '13px', color: '#475569' }}>宝宝喂养记录</p>
  </div>
  <Providers session={session}>
    {children}
  </Providers>
```

3. Update the inline script to also dismiss the splash screen after hydration:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
          navigator.serviceWorker.register('/sw.js').then(
            function(registration) {
              console.log('SW registered: ', registration.scope);
            },
            function(err) {
              console.log('SW registration failed: ', err);
            }
          );
        });
      }
      // Dismiss splash screen after hydration
      requestAnimationFrame(function() {
        setTimeout(function() {
          var splash = document.getElementById('splash');
          if (splash) splash.classList.add('hidden');
        }, 300);
      });
    `,
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add PWA splash screen with fade animation"
```

---

### Task 4: Navbar Redesign

**Files:**
- Modify: `components/Navbar.tsx`

- [ ] **Step 1: Update the mobile navbar to pill indicator style with gradient FAB**

Replace the mobile `<nav>` section (the `md:hidden` nav). Key changes:
- Top corners: `rounded-t-[28px]`
- Active item: pill background with `bg-gradient-to-br from-blue-50 to-sky-50` + blue-600 icon/text
- Inactive: `text-slate-400`
- Center FAB: `w-[52px] h-[52px] rounded-button gradient-primary shadow-elevated`

The complete mobile nav JSX:

```tsx
<nav className="md:hidden fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-blue-100/60 bg-white/98 backdrop-blur-xl shadow-nav supports-[backdrop-filter]:bg-white/92">
  <div className="mx-auto flex max-w-md items-end justify-between gap-1 px-2 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
    {navItems.map((item) => {
      const Icon = item.icon
      const isActive = pathname === item.href
      const isAdd = item.href === '/add'

      if (isAdd) {
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            onMouseEnter={() => prefetchRoute(item.href)}
            onFocus={() => prefetchRoute(item.href)}
            onTouchStart={() => prefetchRoute(item.href)}
            className="flex min-w-[5rem] flex-col items-center justify-end self-start pt-0.5"
          >
            <div className={`mobile-touch-target -mt-5 flex h-[52px] w-[52px] items-center justify-center rounded-button gradient-primary shadow-elevated transition-transform active:scale-95`}>
              <Icon size={24} className="text-white" />
            </div>
            <span className={`mt-1 text-[11px] font-semibold ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
              {item.label}
            </span>
          </Link>
        )
      }

      return (
        <Link
          key={item.href}
          href={item.href}
          aria-label={item.label}
          aria-current={isActive ? 'page' : undefined}
          onMouseEnter={() => prefetchRoute(item.href)}
          onFocus={() => prefetchRoute(item.href)}
          onTouchStart={() => prefetchRoute(item.href)}
          className={`mobile-touch-target flex min-h-[4.25rem] min-w-[4.5rem] flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 transition active:scale-95 ${
            isActive
              ? 'text-blue-600'
              : 'text-slate-400'
          }`}
        >
          <div className={`flex h-[30px] w-[44px] items-center justify-center rounded-[15px] ${
            isActive ? 'bg-gradient-to-br from-blue-50 to-sky-50' : ''
          }`}>
            <Icon size={20} className={isActive ? 'fill-blue-600 text-blue-600' : ''} />
          </div>
          <span className={`mt-1 text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
        </Link>
      )
    })}
  </div>
</nav>
```

- [ ] **Step 2: Update the desktop nav active state**

In the desktop `<nav>` (the `hidden md:block` nav), update the active class:

Change:
```
'bg-blue-50 text-blue-600'
```
To:
```
'bg-gradient-to-r from-blue-50 to-sky-50 text-blue-600 shadow-pressed'
```

- [ ] **Step 3: Verify visual output**

Run: `npm run dev`
Visually check: bottom nav has pill indicators, FAB has gradient, no layout shift

- [ ] **Step 4: Commit**

```bash
git add components/Navbar.tsx
git commit -m "feat: redesign navbar with pill indicators and gradient FAB"
```

---

### Task 5: Dashboard Redesign

**Files:**
- Modify: `components/Dashboard.tsx`

- [ ] **Step 1: Update the loading spinner**

Change:
```tsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
```
To:
```tsx
<div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-100 border-t-brand-500"></div>
```

- [ ] **Step 2: Update the empty state**

Change `bg-blue-600` button to gradient:
```tsx
<Link
  href="/settings"
  className="inline-flex items-center px-6 py-3 gradient-primary text-white rounded-button shadow-elevated hover:opacity-90 transition"
>
```

- [ ] **Step 3: Update baby selector pills**

Change the active state from `bg-blue-600 text-white` to `gradient-primary text-white shadow-elevated`:
```tsx
className={`mobile-touch-target rounded-full whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
  baby.id === resolvedSelectedBabyId
    ? 'gradient-primary text-white shadow-elevated'
    : 'bg-white text-slate-600 shadow-card hover:shadow-pressed'
}`}
```

- [ ] **Step 4: Update baby info card**

Change `bg-white rounded-2xl p-4 sm:p-6 shadow-sm` to `bg-white rounded-card p-4 sm:p-6 shadow-card border border-blue-50`:
```tsx
<div className="bg-white rounded-card p-4 sm:p-6 shadow-card border border-blue-50">
```

- [ ] **Step 5: Update stat cards grid**

Each stat card gets gradient icon container. Replace the entire grid section:

```tsx
<div className="grid grid-cols-2 gap-3">
  <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
    <div className="flex items-center justify-between mb-1.5">
      <div className="w-8 h-8 rounded-element gradient-breast flex items-center justify-center">
        <Droplets size={16} className="text-white" />
      </div>
      <span className="text-xs text-slate-400 font-medium">母乳</span>
    </div>
    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
      {(stats?.breastFeedingCount || 0) + (stats?.breastBottleCount || 0)}
    </p>
    <p className="text-xs text-slate-500">
      亲喂{stats?.breastFeedingCount || 0}次 · {stats?.totalBreastDuration || 0}分钟
    </p>
    {(stats?.breastBottleCount || 0) > 0 && (
      <p className="text-xs text-slate-500">
        瓶喂{stats?.breastBottleCount || 0}次（{stats?.totalBreastMilkAmount || 0}ml）
      </p>
    )}
  </div>

  <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
    <div className="flex items-center justify-between mb-1.5">
      <div className="w-8 h-8 rounded-element gradient-formula flex items-center justify-center">
        <Milk size={16} className="text-white" />
      </div>
      <span className="text-xs text-slate-400 font-medium">奶粉</span>
    </div>
    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{stats?.formulaCount || 0}</p>
    <p className="text-xs text-slate-500">次 · {stats?.totalFormulaAmount || 0}ml</p>
  </div>

  <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
    <div className="flex items-center justify-between mb-1.5">
      <div className="w-8 h-8 rounded-element gradient-ad flex items-center justify-center">
        <Pill size={16} className="text-white" />
      </div>
      <span className="text-xs text-slate-400 font-medium">AD</span>
    </div>
    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
      {stats?.adGiven ? '✓' : '○'}
    </p>
    <p className="text-xs text-slate-500">{stats?.adGiven ? '已服用' : '未服用'}</p>
  </div>

  <div className="bg-white rounded-card p-3 shadow-card border border-blue-50">
    <div className="flex items-center justify-between mb-1.5">
      <div className="w-8 h-8 rounded-element gradient-diaper flex items-center justify-center">
        <BabyIcon size={16} className="text-white" />
      </div>
      <span className="text-xs text-slate-400 font-medium">大小便</span>
    </div>
    <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
      {stats?.peeCount || 0} / {stats?.poopCount || 0}
    </p>
    <p className="text-xs text-slate-500">小便 / 大便</p>
  </div>
</div>
```

- [ ] **Step 6: Update quick actions grid**

Replace the quick actions section:

```tsx
<div className="bg-white rounded-card p-4 shadow-card border border-blue-50">
  <h3 className="text-base font-bold text-slate-900 mb-3">快捷记录</h3>
  <div className="grid grid-cols-4 gap-2">
    <Link href="/add?type=breast" className="flex flex-col items-center py-3 bg-gradient-to-b from-pink-50 to-pink-100/80 rounded-button border border-pink-100/60 hover:shadow-pressed transition active:scale-95">
      <div className="w-9 h-9 rounded-element gradient-breast flex items-center justify-center shadow-sm mb-1.5">
        <Droplets size={18} className="text-white" />
      </div>
      <span className="text-[11px] font-semibold text-pink-700">母乳</span>
    </Link>
    <Link href="/add?type=formula" className="flex flex-col items-center py-3 bg-gradient-to-b from-blue-50 to-blue-100/80 rounded-button border border-blue-100/60 hover:shadow-pressed transition active:scale-95">
      <div className="w-9 h-9 rounded-element gradient-formula flex items-center justify-center shadow-sm mb-1.5">
        <Milk size={18} className="text-white" />
      </div>
      <span className="text-[11px] font-semibold text-blue-700">奶粉</span>
    </Link>
    <Link href="/add?type=ad" className="flex flex-col items-center py-3 bg-gradient-to-b from-orange-50 to-orange-100/80 rounded-button border border-orange-100/60 hover:shadow-pressed transition active:scale-95">
      <div className="w-9 h-9 rounded-element gradient-ad flex items-center justify-center shadow-sm mb-1.5">
        <Pill size={18} className="text-white" />
      </div>
      <span className="text-[11px] font-semibold text-orange-700">AD滴剂</span>
    </Link>
    <Link href="/add?type=health" className="flex flex-col items-center py-3 bg-gradient-to-b from-green-50 to-green-100/80 rounded-button border border-green-100/60 hover:shadow-pressed transition active:scale-95">
      <div className="w-9 h-9 rounded-element gradient-health flex items-center justify-center shadow-sm mb-1.5">
        <Scale size={18} className="text-white" />
      </div>
      <span className="text-[11px] font-semibold text-green-700">健康</span>
    </Link>
  </div>
</div>
```

- [ ] **Step 7: Update today's records section**

```tsx
<div className="bg-white rounded-card p-4 shadow-card border border-blue-50">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-base font-bold text-slate-900">今日记录</h3>
    <Link href="/timeline" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
      全部 <ChevronRight size={16} />
    </Link>
  </div>
  ...
```

Update each record row: change `bg-gray-50 rounded-lg` to `bg-slate-50/80 rounded-element border border-slate-100/60`:
```tsx
<div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-element border border-slate-100/60">
```

Change icon circle: `bg-gray-100` → `bg-white shadow-sm`:
```tsx
<div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
```

- [ ] **Step 8: Update health data section**

Change `bg-white rounded-2xl p-3 shadow-sm` to `bg-white rounded-card p-3 shadow-card border border-blue-50`.

- [ ] **Step 9: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: redesign dashboard with gradient cards and new quick actions"
```

---

### Task 6: StatsUi & RecordActionBar Updates

**Files:**
- Modify: `components/StatsUi.tsx`
- Modify: `components/RecordActionBar.tsx`

- [ ] **Step 1: Update StatsPanel**

```tsx
export function StatsPanel({ children, className = '' }: StatsPanelProps) {
  return <div className={`rounded-card bg-white p-4 shadow-card border border-blue-50 ${className}`.trim()}>{children}</div>
}
```

- [ ] **Step 2: Update StatsFeatureCard**

```tsx
export function StatsFeatureCard({
  children,
  title,
  icon: Icon,
  className = '',
  iconClassName = 'text-white',
  titleClassName = 'text-sm font-semibold text-slate-900',
}: StatsFeatureCardProps) {
  return (
    <div className={`rounded-card bg-white p-4 shadow-card border border-blue-50 ${className}`.trim()}>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={16} className={iconClassName} />
        <h3 className={titleClassName}>{title}</h3>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Update StatsSegmentedTabs**

```tsx
export function StatsSegmentedTabs({
  items,
  value,
  onChange,
  className = '',
}: StatsSegmentedTabsProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 rounded-card bg-slate-50 p-1 ${className}`.trim()}>
      {items.map(item => {
        const active = item.key === value

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => !item.disabled && onChange(item.key)}
            disabled={item.disabled}
            className={`min-w-0 flex-1 rounded-button px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
              active
                ? 'bg-white text-blue-600 shadow-card'
                : item.disabled
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }`}
            title={item.description}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Update RecordActionBar submit button**

In `RecordActionBar.tsx`, change the submit button classes:

The create-mode button:
```tsx
<button
  type="submit"
  disabled={loading || disabled}
  className="mobile-touch-target w-full rounded-button gradient-primary px-4 py-3 font-medium text-white shadow-elevated transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
>
  {loading ? loadingLabel : primaryLabel}
</button>
```

The edit-mode primary button:
```tsx
<button
  type="button"
  onClick={onPrimaryClick}
  disabled={loading || disabled}
  className="mobile-touch-target flex flex-1 items-center justify-center gap-1 rounded-button gradient-primary px-4 py-3 text-sm font-medium text-white shadow-elevated transition hover:opacity-90 disabled:opacity-50"
>
  {loading ? loadingLabel : (<><Check size={16} />{primaryLabel}</>)}
</button>
```

The edit-mode cancel button:
```tsx
<button
  type="button"
  onClick={onCancel}
  className="mobile-touch-target flex-1 rounded-button bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
>
  取消
</button>
```

Update wrapper classes:
- Create mode: change `shadow-[0_-8px_24px_rgba(15,23,42,0.08)]` to `shadow-nav`
- Keep `rounded-2xl` → `rounded-card`

- [ ] **Step 5: Commit**

```bash
git add components/StatsUi.tsx components/RecordActionBar.tsx
git commit -m "feat: update StatsUi panels/tabs and RecordActionBar with gradient button"
```

---

### Task 7: Login Page & Form Styles

**Files:**
- Modify: `app/login/LoginClient.tsx`
- Modify: `components/FeedingForm.tsx` (type selector styling)
- Modify: `components/HealthForm.tsx` (type selector styling)

- [ ] **Step 1: Redesign LoginClient**

Update the outer container and form card:

```tsx
<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-blue-50 to-pink-50 px-4">
  <div className="max-w-md w-full space-y-8">
    <div className="text-center splash-logo">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-card gradient-icon shadow-elevated mb-4">
        <svg width="36" height="36" viewBox="0 0 56 56" fill="none">
          <rect x="15" y="18" width="24" height="32" rx="8" fill="white" opacity="0.95"/>
          <rect x="20" y="9" width="14" height="10" rx="5" fill="white" opacity="0.95"/>
          <path d="M23 9 Q27 3.5 31 9" fill="white" opacity="0.95" stroke="white" strokeWidth="1.5"/>
          <rect x="17" y="30" width="20" height="18" rx="6.5" fill="rgba(244,114,182,0.25)"/>
          <path d="M27 33 C25 31 22.5 31.8 22.5 33.8 C22.5 35.8 27 38.5 27 38.5 C27 38.5 31.5 35.8 31.5 33.8 C31.5 31.8 29 31 27 33Z" fill="rgba(59,130,246,0.5)"/>
        </svg>
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Baby Feed</h1>
      <p className="text-slate-500 mt-1">宝宝喂养记录</p>
    </div>

    <form onSubmit={handleSubmit} className="mt-8 space-y-6 bg-white p-8 rounded-card shadow-card border border-blue-50">
```

Update input classes:
```tsx
className="w-full px-4 py-3 border border-slate-200 rounded-element focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition bg-white"
```

Update submit button:
```tsx
<button
  type="submit"
  disabled={loading}
  className="w-full py-3 px-4 gradient-primary text-white font-medium rounded-button shadow-elevated transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
>
  {loading ? '登录中...' : '登录'}
</button>
```

- [ ] **Step 2: Update type selector pills in FeedingForm**

In `FeedingForm.tsx`, locate the type selector buttons (the ones that switch between BREAST_MILK, FORMULA, etc.). Update their active/inactive classes to use category-colored backgrounds:

For any `bg-blue-600 text-white` active state → use `gradient-primary text-white shadow-sm`
For inactive → use `bg-slate-100 text-slate-600 hover:bg-slate-150`

(The exact location varies — search for type selector button styling and apply consistently.)

- [ ] **Step 3: Update type selector pills in HealthForm**

Same pattern as FeedingForm — update health type selector buttons.

- [ ] **Step 4: Commit**

```bash
git add app/login/LoginClient.tsx components/FeedingForm.tsx components/HealthForm.tsx
git commit -m "feat: redesign login page and form type selectors"
```

---

### Task 8: Timeline & Settings & MemoSection

**Files:**
- Modify: `components/Timeline.tsx`
- Modify: `components/Settings.tsx`
- Modify: `components/MemoSection.tsx`

- [ ] **Step 1: Update Timeline record items**

In the Timeline component, find record item containers. Update their classes:
- Card wrappers: `bg-white rounded-2xl shadow-sm` → `bg-white rounded-card shadow-card border border-blue-50`
- Individual record items: add subtle left border using category color. For each record row, update:

```tsx
// Add border-l-3 with category color based on record type
const getBorderColor = (type: string) => {
  switch (type) {
    case 'BREAST_MILK':
    case 'BREAST_MILK_BOTTLE': return 'border-l-pink-400'
    case 'FORMULA': return 'border-l-blue-400'
    case 'AD_VITAMIN': return 'border-l-orange-400'
    case 'WEIGHT':
    case 'HEIGHT': return 'border-l-green-400'
    case 'TEMPERATURE': return 'border-l-red-400'
    case 'DIAPER': return 'border-l-amber-400'
    case 'SLEEP': return 'border-l-violet-400'
    default: return 'border-l-slate-300'
  }
}
```

Apply to record rows:
```tsx
<div className={`flex items-center p-3 bg-white rounded-element border border-slate-100/60 border-l-[3px] ${getBorderColor(record.type)}`}>
```

- [ ] **Step 2: Update Settings section cards**

In `Settings.tsx`, find card container classes and update:
- `bg-white rounded-2xl shadow-sm` → `bg-white rounded-card shadow-card border border-blue-50`
- Any `bg-blue-600` buttons → `gradient-primary shadow-elevated`
- Delete/danger buttons: keep red color but update to `bg-red-50 text-red-600 border border-red-100 rounded-button`

- [ ] **Step 3: Update MemoSection**

`MemoSection` uses `StatsPanel` which is already updated. Verify no additional hardcoded `shadow-sm` or `rounded-2xl` styles need updating. The main adjustment:
- Action buttons (add memo, toggle complete): update to consistent styling
- "Add" button: ensure it uses `gradient-primary text-white rounded-button shadow-sm`

- [ ] **Step 4: Commit**

```bash
git add components/Timeline.tsx components/Settings.tsx components/MemoSection.tsx
git commit -m "feat: update timeline borders, settings cards, and memo section"
```

---

### Task 9: Record Display Icon Colors

**Files:**
- Modify: `lib/record-display.tsx`

- [ ] **Step 1: Update icon color classes for richer palette**

The `getRecordIcon` function uses Tailwind color classes. Update to match the new design system's category colors:

```tsx
export function getRecordIcon(type: string, size: number = 20) {
  switch (type) {
    case 'BREAST_MILK':
    case 'BREAST_MILK_BOTTLE':
      return <Droplets size={size} className="text-pink-500" />
    case 'FORMULA':
      return <Milk size={size} className="text-blue-500" />
    case 'AD_VITAMIN':
      return <Pill size={size} className="text-orange-500" />
    case 'WEIGHT':
      return <Scale size={size} className="text-emerald-500" />
    case 'HEIGHT':
      return <Ruler size={size} className="text-cyan-500" />
    case 'TEMPERATURE':
      return <Thermometer size={size} className="text-red-500" />
    case 'MEDICATION':
      return <Pill size={size} className="text-violet-500" />
    case 'VACCINE':
      return <Syringe size={size} className="text-teal-500" />
    case 'DIAPER':
      return <BabyIcon size={size} className="text-amber-500" />
    case 'SLEEP':
      return <Moon size={size} className="text-violet-500" />
    case 'SOLID_FOOD':
      return <UtensilsCrossed size={size} className="text-orange-500" />
    default:
      return null
  }
}
```

(Minimal changes: `green-500` → `emerald-500` for weight, `blue-500` → `cyan-500` for height, `purple-500` → `violet-500` for medication/sleep to better match the design system accent palette.)

- [ ] **Step 2: Commit**

```bash
git add lib/record-display.tsx
git commit -m "feat: update record icon colors to match new design palette"
```

---

### Task 10: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: No errors (warnings acceptable)

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Visual spot check**

Run: `npm run dev`
Verify in browser:
- Dashboard: gradient stat cards, new quick actions, baby selector pills
- Bottom nav: pill indicator for active item, gradient FAB
- Add page: gradient submit button, form inputs with new border radius
- Login page: new icon, gradient background, gradient button
- Timeline: category colored left borders
- Settings: consistent card styling
- Splash screen appears briefly on cold load

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: polish styling inconsistencies from redesign"
```
