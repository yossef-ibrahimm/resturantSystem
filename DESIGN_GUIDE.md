# Tasty Table — Design System Guide

> Complete design system documentation for AI agents working on UI/UX improvements.
> This document covers every visual aspect of the application: colors, typography, spacing, components, layouts, and page-by-page design patterns.

---

## 1. Project Overview

**Tasty Table** is an Arabic-first (RTL) restaurant management system with:
- **Public-facing**: Menu browsing, ordering, order status tracking
- **Admin panel**: Dashboard, menu management, order history, staff management, attendance, branding settings
- **Staff screens**: Kitchen display, waiter display
- **Tech stack**: React + TypeScript + Tailwind CSS + shadcn/ui + Radix primitives

**Default language**: Arabic (RTL). English (LTR) is fully supported via language toggle.

---

## 2. Color System

### 2.1 Design Tokens (CSS Variables — HSL format)

All colors are defined as HSL triplets (e.g., `153 32% 18%`) in `src/index.css` and consumed via `hsl(var(--token))`.

#### Light Mode (default)

| Token | HSL Value | Hex Approx | Usage |
|-------|-----------|------------|-------|
| `--background` | `38 33% 96%` | `#F5F0E8` | Page background — warm cream |
| `--foreground` | `150 18% 12%` | `#1C2B1A` | Primary text — deep forest |
| `--card` | `36 40% 98%` | `#FBF8F3` | Card backgrounds |
| `--card-foreground` | `150 18% 12%` | `#1C2B1A` | Card text |
| `--popover` | `36 40% 98%` | `#FBF8F3` | Dropdown/popover background |
| `--popover-foreground` | `150 18% 12%` | `#1C2B1A` | Dropdown text |
| `--primary` | `153 32% 18%` | `#1F4D2E` | Primary brand — deep forest green |
| `--primary-foreground` | `38 40% 96%` | `#F5F0E8` | Text on primary |
| `--primary-glow` | `153 28% 32%` | `#2D6B3F` | Hover glow effect |
| `--secondary` | `36 22% 92%` | `#E8E0D4` | Secondary surfaces |
| `--secondary-foreground` | `150 18% 12%` | `#1C2B1A` | Secondary text |
| `--muted` | `36 22% 90%` | `#E2D9CC` | Muted backgrounds, placeholders |
| `--muted-foreground` | `150 8% 38%` | `#5A6B57` | Subtle text, labels |
| `--accent` | `16 55% 52%` | `#C4612A` | Accent — terracotta/warm orange |
| `--accent-foreground` | `38 40% 96%` | `#F5F0E8` | Text on accent |
| `--accent-soft` | `16 60% 92%` | `#F5DDD0` | Soft accent backgrounds |
| `--destructive` | `0 65% 48%` | `#D32F2F` | Destructive actions — red |
| `--destructive-foreground` | `38 40% 96%` | `#F5F0E8` | Text on destructive |
| `--border` | `36 18% 84%` | `#D4CAB9` | Borders |
| `--input` | `36 18% 84%` | `#D4CAB9` | Input borders |
| `--ring` | `153 32% 18%` | `#1F4D2E` | Focus ring |

#### Dark Mode (`.dark` class)

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | `150 20% 7%` | Dark forest background |
| `--foreground` | `38 30% 94%` | Light text |
| `--card` | `150 18% 10%` | Dark card backgrounds |
| `--primary` | `38 40% 92%` | Light primary (inverted) |
| `--primary-foreground` | `150 20% 7%` | Dark text on primary |
| `--accent` | `16 60% 58%` | Brighter terracotta |
| `--muted` | `150 12% 16%` | Dark muted |
| `--muted-foreground` | `38 12% 65%` | Subtle text |
| `--border` | `150 12% 18%` | Dark borders |

### 2.2 Brand Palette Summary

| Color | Role | CSS Variable |
|-------|------|-------------|
| Warm Cream `#F5F0E8` | Background | `--background` |
| Deep Forest Green `#1F4D2E` | Primary | `--primary` |
| Terracotta `#C4612A` | Accent | `--accent` |
| Soft Cream `#FBF8F3` | Card | `--card` |
| Muted Beige `#E2D9CC` | Muted | `--muted` |
| Red `#D32F2F` | Destructive | `--destructive` |

### 2.3 Gradients

| Name | CSS Variable | Value |
|------|-------------|-------|
| Warm | `--gradient-warm` | `linear-gradient(135deg, hsl(36 40% 96%) 0%, hsl(36 50% 92%) 100%)` |
| Hero | `--gradient-hero` | `linear-gradient(180deg, hsl(150 25% 8% / 0.1) 0%, hsl(150 25% 8% / 0.85) 100%)` |
| Accent | `--gradient-accent` | `linear-gradient(135deg, hsl(16 55% 52%), hsl(22 62% 58%))` |

### 2.4 Shadows

| Name | CSS Variable | Usage |
|------|-------------|-------|
| Soft | `--shadow-soft` | Subtle elevation for cards, inputs |
| Elegant | `--shadow-elegant` | Hero sections, modals |
| Card | `--shadow-card` | Menu cards on hover |

### 2.5 Status Colors (Hardcoded Tailwind)

Used in order status badges (`src/lib/constants.ts`):

| Status | Badge Classes |
|--------|--------------|
| Received | `bg-blue-100 text-blue-800 border-blue-200` |
| Preparing | `bg-amber-100 text-amber-800 border-amber-200` |
| Ready | `bg-green-100 text-green-800 border-green-200` |
| Completed | `bg-gray-100 text-gray-600 border-gray-200` |

### 2.6 Social Brand Colors (Hardcoded in MenuFooter)

| Platform | Hover Color |
|----------|------------|
| Facebook | `#1877F2` |
| Instagram | `#E4405F` |
| TikTok | `foreground` (inherits) |
| WhatsApp | `#25D366` |

---

## 3. Typography

### 3.1 Font Families

| Font | Variable | Usage |
|------|----------|-------|
| **Fraunces** | `font-display` | Headings (h1–h4). **Note: Not loaded in index.html — falls back to Georgia serif** |
| **Inter** | `font-sans` | Body text, UI elements, inputs |
| **Cairo** | HTML override | Arabic body text (`html[lang="ar"] body`) |

### 3.2 Font Sizes & Weights

| Element | Tailwind Classes |
|---------|-----------------|
| Page title (h1) | `text-3xl font-bold mb-2` (MenuPage) or `text-2xl font-bold tracking-tight` (Admin) |
| Section title (h2) | `text-xl font-semibold` |
| Card title (h3) | `text-2xl font-semibold leading-none tracking-tight` |
| Body text | `text-sm` (14px) or `text-base` (16px) |
| Small text / labels | `text-xs` (12px) |
| Muted text | `text-sm text-muted-foreground` |
| Price text | `text-accent font-bold text-sm` |
| Badge text | `text-xs font-semibold` |

### 3.3 Headings

```css
h1, h2, h3, h4 {
  @apply font-display tracking-tight;
}
```

**Note:** `font-display` maps to Fraunces (serif) but is not loaded — falls back to Georgia.

---

## 4. Spacing & Layout

### 4.1 Container

```css
/* tailwind.config.ts */
container: {
  center: true,
  padding: "1.5rem",     /* 24px horizontal padding */
  screens: { "2xl": "1320px" }
}
```

- Max width: `1320px`
- Padding: `1.5rem` (24px) on all sides
- Centered with `mx-auto`

### 4.2 Common Spacing Patterns

| Context | Spacing |
|---------|---------|
| Page section gap | `space-y-6` (24px) or `space-y-8` (32px) |
| Card internal padding | `p-6` (24px) |
| Grid gap | `gap-4` (16px) for card grids, `gap-8` (32px) for section grids |
| Form field gap | `space-y-2` or `space-y-4` |
| Inline element gap | `gap-2` (8px) or `gap-3` (12px) |
| Page top/bottom padding | `py-8` (32px) or `py-12` (48px) |

### 4.3 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` (12px) | Base radius |
| `lg` | `var(--radius)` = 12px | Cards, modals |
| `md` | `calc(var(--radius) - 2px)` = 10px | Buttons, inputs |
| `sm` | `calc(var(--radius) - 4px)` = 8px | Badges, small elements |

### 4.4 Breakpoints

| Breakpoint | Width | Usage |
|-----------|-------|-------|
| `sm` | 640px | 2-column menu grid |
| `md` | 768px | 2-column footer, sidebar visible |
| `lg` | 1024px | 3-column menu grid, admin layout |
| `xl` | 1280px | 4-column menu grid |
| `2xl` | 1320px | Max container width |

---

## 5. Component Library (shadcn/ui)

All components live in `src/components/ui/` and use Radix primitives + class-variance-authority (CVA).

### 5.1 Button

**Variants:**
| Variant | Classes |
|---------|---------|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` |
| `link` | `text-primary underline-offset-4 hover:underline` |

**Sizes:** `default` (h-10), `sm` (h-9), `lg` (h-11), `icon` (h-10 w-10)

**Base classes:**
```
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium
ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2
focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
```

### 5.2 Card

```
rounded-lg border bg-card text-card-foreground shadow-sm
```

Sub-components: `CardHeader` (p-6), `CardContent` (p-6 pt-0), `CardFooter` (p-6 pt-0), `CardTitle` (text-2xl font-semibold), `CardDescription` (text-sm text-muted-foreground)

### 5.3 Badge

**Variants:**
| Variant | Classes |
|---------|---------|
| `default` | `border-transparent bg-primary text-primary-foreground` |
| `secondary` | `border-transparent bg-secondary text-secondary-foreground` |
| `destructive` | `border-transparent bg-destructive text-destructive-foreground` |
| `outline` | `text-foreground` |

Base: `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold`

### 5.4 Input

```
flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base
ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

### 5.5 Skeleton

```
animate-pulse rounded-md bg-muted
```

### 5.6 Separator

```
shrink-0 bg-border
```
Horizontal: `h-[1px] w-full` | Vertical: `h-full w-[1px]`

### 5.7 Table

- `Table`: `w-full caption-bottom text-sm`
- `TableRow`: `border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50`
- `TableHead`: `h-12 px-4 text-left font-medium text-muted-foreground`
- `TableCell`: `p-4 align-middle`

---

## 6. Page-by-Page Design Breakdown

### 6.1 Public Layout (Navbar + Page)

**Structure:** `flex min-h-screen flex-col` → `Navbar` + `main flex-1`

#### Navbar (`src/components/layout/Navbar.tsx`)
- Sticky: `sticky top-0 z-50 w-full`
- Border: `border-b border-border/60`
- Background: `bg-background/80 backdrop-blur-md` (glassmorphism)
- Height: `h-16`
- Logo area: `flex items-center gap-2 font-display text-xl font-semibold tracking-tight`
- Nav links: `text-sm font-medium`, active state adds `after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-accent`
- Cart badge: `absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white`
- Mobile menu: slide-down with `max-h-96` transition, links use `rounded-md px-3 py-2`

### 6.2 Menu Page (`src/features/menu/components/MenuPage.tsx`)

**Layout:**
- Optional background image: `fixed inset-0 z-0 bg-cover bg-center` with `bg-background/20 backdrop-blur-sm` overlay
- Content: `container py-8 relative z-10`

**Category Filter:**
- Horizontal scrollable: `flex gap-2 mb-8 overflow-x-auto pb-2`
- Buttons: `rounded-full whitespace-nowrap`, variant toggles between `default` and `outline`

**Menu Grid:**
- Responsive: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`
- Cards: `overflow-hidden hover:shadow-card transition-shadow group`
- Image: `aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105`
- Sold out overlay: `absolute inset-0 bg-background/60`
- Price: `text-accent font-bold whitespace-nowrap text-sm`
- Description: `text-muted-foreground text-xs line-clamp-2`
- Add button: full width `Button size="sm"`

**Bill Request FAB:**
- Fixed bottom-right: `fixed bottom-6 end-6 z-50`
- Style: `rounded-full shadow-lg h-14 px-6`

### 6.3 Menu Footer (`src/features/menu/components/MenuFooter.tsx`)

**Always visible** (even when fields are null — shows "Not configured" placeholders)

**Layout:**
- Border top: `border-t border-border`
- Background: `bg-gradient-to-b from-transparent via-background/60 to-background/90 backdrop-blur-sm`
- Inner: `container py-12`
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-10`

**Section headers:**
- Decorative line: `h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent`
- Text: `font-semibold text-base uppercase tracking-wider text-foreground/80`

**Contact items:**
- Icon container: `flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10`
- Icon: `h-3.5 w-3.5 text-primary`
- Row: `flex items-center gap-3 rounded-lg px-3 py-2.5`
- Unset state: `opacity-50 cursor-default` with italic placeholder text

**Social icons:**
- Container: `flex h-11 w-11 items-center justify-center rounded-xl`
- Default: `bg-primary/5 text-foreground/60`
- Hover: Platform-specific colors with `hover:shadow-md hover:shadow-[color]/10`
- Unset: `bg-muted/50 text-muted-foreground/30 cursor-default`

**Copyright:**
- `mt-10 pt-6 border-t border-border/50 text-center`
- Text: `text-xs text-muted-foreground/60`

### 6.4 Login Page (`src/features/auth/components/LoginPage.tsx`)

**Layout:** `min-h-screen flex items-center justify-center bg-gradient-warm p-4`

**Card:** `w-full max-w-md`

**Logo area:**
- Circle: `mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10`
- Logo image: `h-8 w-auto` or fallback icon `h-6 w-6 text-primary`

**Form:**
- Error: `rounded-md bg-destructive/10 p-3 text-sm text-destructive`
- Fields: `space-y-4`
- Submit: `Button className="w-full" size="lg"`

### 6.5 Order Status Page (`src/features/orders/components/OrderStatusPage.tsx`)

**Layout:** `container py-8 max-w-2xl mx-auto`

**Status Progress:**
- Steps: `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold`
  - Active: `bg-primary text-primary-foreground`
  - Inactive: `bg-muted text-muted-foreground`
- Progress bar: `absolute top-4 left-4 right-4 h-0.5 bg-muted` with `bg-primary` fill
- Step labels: `text-xs mt-1 text-center whitespace-nowrap`

**Bill requested card:**
- `border-orange-200 bg-orange-500/5`
- Icon: `h-5 w-5 text-orange-600`
- Text: `font-semibold text-orange-700`

### 6.6 Kitchen Page (`src/features/kitchen/components/KitchenPage.tsx`)

- Full-screen dark layout for kitchen display
- Uses `ScrollArea` for order list
- Order cards with elapsed time display
- Status buttons for marking orders as ready

### 6.7 Waiter Page (`src/features/waiter/components/WaiterPage.tsx`)

- Similar to kitchen — full-screen display
- Bill request indicators with orange badges
- Delivery acknowledgment buttons

### 6.8 Admin Layout (`src/features/admin/components/AdminLayout.tsx`)

**Structure:** Sidebar + main content area

**Sidebar:**
- Uses shadcn `Sidebar` component
- Navigation items with icons
- Active state: `bg-sidebar-accent text-sidebar-accent-foreground`

### 6.9 Branding Settings (`src/features/admin/components/BrandingSettings.tsx`)

**Form:**
- Uses `react-hook-form` + `zod` validation
- Three `Card` sections: Identity, Brand Colors, Contact & Social

**Identity section:**
- Two-column grid for name fields
- Image upload components for logo and background

**Brand Colors section:**
- Three-column grid (`sm:grid-cols-3`) with color pickers
- Each picker: native `<input type="color">` + hex text input + reset link

**Action bar:**
- `flex items-center justify-between`
- Left: Reset All button (`variant="outline"`)
- Right: Save button (`variant="default"`)

---

## 7. Animations & Transitions

### 7.1 Custom Animations

| Name | Keyframes | Usage |
|------|-----------|-------|
| `accordion-down` | height 0 → content height | Accordion expand |
| `accordion-up` | content height → 0 | Accordion collapse |
| `fade-up` | opacity 0 + translateY(16px) → visible | Page load animations |

### 7.2 Transition Patterns

| Pattern | Classes |
|---------|---------|
| Smooth all | `transition-colors` (default) |
| Scale on hover | `transition-transform duration-300 group-hover:scale-105` (menu images) |
| Shadow on hover | `hover:shadow-card transition-shadow` (cards) |
| Backdrop blur | `backdrop-blur-md` (navbar, footer) |
| Max-height slide | `transition-[max-height] duration-300 ease-in-out` (mobile menu) |

### 7.3 Timing Function

```css
--transition-smooth: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

Tailwind: `ease-smooth` → `cubic-bezier(0.4, 0, 0.2, 1)`

---

## 8. RTL / Bilingual Support

### 8.1 RTL Configuration

- `index.html`: `<html lang="ar" dir="rtl">`
- CSS: `[dir="rtl"] { text-align: right; }`
- Font override: `html[lang="ar"] body { font-family: "Cairo", "Inter", ... }`

### 8.2 Language Toggle

- Globe icon button in Navbar (both desktop and mobile)
- `useLanguage()` hook provides `isArabic`, `language`, `toggleLanguage()`
- All text uses `isArabic ? arabicText : englishText` pattern

### 8.3 Layout Direction

- `dir="ltr"` on horizontal scrollable areas (category filter)
- `dir="ltr"` on phone numbers
- RTL margins: `ms-2` (margin-inline-start) instead of `ml-2`

---

## 9. Dynamic Branding (Admin-Configurable)

Admin can customize via Settings → Branding page. Changes apply in real-time via WebSocket.

### 9.1 Branding Fields

| Field | Type | CSS Variable Affected |
|-------|------|----------------------|
| `nameAr` / `nameEn` | string | `document.title` + Navbar logo text |
| `logoUrl` | image URL | Navbar logo, Login page logo |
| `menuBackgroundUrl` | image URL | Menu page fixed background |
| `primaryColor` | hex color | `--primary`, `--primary-foreground`, `--ring` |
| `secondaryColor` | hex color | `--accent` |
| `backgroundColor` | hex color | `--background`, `--card` |
| `contactPhone` | string | MenuFooter phone link |
| `contactAddress` | string | MenuFooter address |
| `workingHours` | string | MenuFooter hours |
| `facebookUrl` | URL | MenuFooter social link |
| `instagramUrl` | URL | MenuFooter social link |
| `tiktokUrl` | URL | MenuFooter social link |
| `whatsappNumber` | string | MenuFooter WhatsApp link |

### 9.2 How Branding Applies

`BrandingProvider` (wraps entire app) reads settings from API and applies CSS variables:

```typescript
// primaryColor → --primary, --primary-foreground, --ring
// secondaryColor → --accent
// backgroundColor → --background, --card
```

**Conversion:** hex → HSL via `hexToHsl()` utility in BrandingProvider.

---

## 10. Utility Functions

| Function | File | Purpose |
|----------|------|---------|
| `cn()` | `src/lib/utils.ts` | Merge Tailwind classes (clsx + twMerge) |
| `formatPrice()` | `src/lib/utils.ts` | Format price as "1,234 ج.م" or "1,234 EGP" |
| `formatDate()` | `src/lib/utils.ts` | Format datetime locale-aware |
| `timeAgo()` | `src/lib/utils.ts` | Relative time "منذ 5 دقيقة" / "5m ago" |
| `getElapsedMinutes()` | `src/lib/utils.ts` | Minutes since date |
| `formatElapsed()` | `src/lib/utils.ts` | "5د" / "5m" elapsed format |
| `hexToHsl()` | `BrandingProvider.tsx` | Convert hex color to HSL string |
| `getContrastColor()` | `BrandingProvider.tsx` | Get contrasting foreground color |

---

## 11. File Structure Reference

```
src/
├── index.css                    # Design tokens (CSS variables), base styles
├── App.tsx                      # Routes, providers (QueryClient, Language, Branding)
├── components/
│   ├── ui/                      # shadcn/ui components (48 files)
│   ├── layout/
│   │   └── Navbar.tsx           # Public navbar with glassmorphism
│   ├── BrandingProvider.tsx     # Dynamic CSS variable injection
│   └── BrandingSettings.tsx     # Admin branding form
├── features/
│   ├── menu/components/         # MenuPage, MenuFooter
│   ├── checkout/components/     # CheckoutPage
│   ├── orders/components/       # OrderStatusPage
│   ├── auth/components/         # LoginPage, ChangePasswordPage
│   ├── admin/components/        # AdminLayout, Dashboard, MenuManagement, etc.
│   ├── kitchen/components/      # KitchenPage
│   ├── waiter/components/       # WaiterPage
│   └── attendance/components/   # AttendancePage
├── hooks/
│   ├── useSettings.ts           # react-query for settings
│   └── useOrders.ts             # react-query for orders
├── lib/
│   ├── api.ts                   # API client functions
│   ├── types.ts                 # TypeScript interfaces
│   ├── constants.ts             # Status flows, labels, colors
│   └── utils.ts                 # Utility functions
├── i18n/
│   ├── ar.ts                    # Arabic translations
│   └── en.ts                    # English translations
└── stores/                      # Zustand stores (auth, cart, activeOrder)
```

---

## 12. Known Design Issues & Improvement Areas

### Current Issues
1. **Fraunces font not loaded** — `font-display` references Fraunces but only Cairo and Inter are loaded in `index.html`. Falls back to Georgia serif.
2. **Dark mode defined but not toggled** — `.dark` class exists in CSS but no toggle mechanism in UI.
3. **Status colors hardcoded** — `STATUS_COLORS` in constants.ts use raw Tailwind classes, not CSS variables.
4. **Social colors hardcoded** — Platform-specific hover colors in MenuFooter are inline hex values.
5. **No loading skeleton for all pages** — Only MenuPage and OrderHistory have skeleton states.
6. **Mobile menu could be smoother** — Uses max-height transition, could use slide animation.
7. **No consistent empty state design** — Each page designs its own empty state differently.
8. **Footer social icons disabled state** — Uses `opacity-50` and `cursor-default` but no tooltip explaining why.

### Improvement Suggestions
1. Add Fraunces font to `index.html` or switch `font-display` to Cairo/Inter
2. Add dark mode toggle in Navbar settings
3. Move status colors and social colors to CSS variables
4. Create consistent empty state component with illustration
5. Add loading skeletons to all data-fetching pages
6. Consider a design token builder (e.g., using CSS `color-mix()`)
7. Add micro-interactions (button press, card hover lift)
8. Standardize section header style (used in footer, could be a component)
9. Add print stylesheet for order receipts
10. Consider adding a "brand preview" in branding settings that shows how the menu will look

---

*Last updated: 2026-08-23*
