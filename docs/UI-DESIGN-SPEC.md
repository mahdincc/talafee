# Talafee UI Design Specification

> Gold Price Comparison Platform - Modern Minimal Design System

---

## Design Philosophy

**Vision**: A clean, data-focused interface that makes gold price comparison effortless. The design prioritizes clarity and trust while maintaining a subtle premium feel through restrained gold accents.

**Principles**:
1. **Data First** - Prices and comparisons are the hero, not decorations
2. **Instant Clarity** - Users understand price differences at a glance
3. **Bilingual Harmony** - Persian (RTL) and English (LTR) feel equally native
4. **Trustworthy** - Clean aesthetics that inspire confidence in financial data

---

## Color Palette

### Core Colors

```css
:root {
  /* Neutral Foundation */
  --color-background:      #FAFAFA;     /* Page background */
  --color-surface:         #FFFFFF;     /* Cards, panels */
  --color-surface-elevated:#FFFFFF;     /* Modals, dropdowns */

  /* Text Hierarchy */
  --color-text-primary:    #1A1A1A;     /* Headlines, prices */
  --color-text-secondary:  #6B7280;     /* Labels, descriptions */
  --color-text-tertiary:   #9CA3AF;     /* Placeholders, hints */

  /* Borders & Dividers */
  --color-border:          #E5E7EB;     /* Default borders */
  --color-border-subtle:   #F3F4F6;     /* Subtle separators */
  --color-border-focus:    #D4AF37;     /* Focus states */

  /* Gold Accent (Primary Brand) */
  --color-gold-50:         #FDF8E8;     /* Subtle backgrounds */
  --color-gold-100:        #F9EDCC;     /* Hover states */
  --color-gold-200:        #F0D98C;     /* Light accent */
  --color-gold-400:        #D4AF37;     /* Primary gold */
  --color-gold-500:        #C5A028;     /* Hover gold */
  --color-gold-600:        #A68523;     /* Pressed gold */
  --color-gold-700:        #8B6914;     /* Dark gold text */

  /* Semantic Colors */
  --color-success:         #10B981;     /* Price up, positive */
  --color-success-bg:      #ECFDF5;     /* Success background */
  --color-danger:          #EF4444;     /* Price down, negative */
  --color-danger-bg:       #FEF2F2;     /* Danger background */
  --color-warning:         #F59E0B;     /* Alerts, caution */
  --color-warning-bg:      #FFFBEB;     /* Warning background */
  --color-info:            #3B82F6;     /* Information */
  --color-info-bg:         #EFF6FF;     /* Info background */

  /* Best Deal Highlight */
  --color-best-deal:       #059669;     /* Best price indicator */
  --color-best-deal-bg:    #D1FAE5;     /* Best deal card bg */
}
```

### Dark Mode Colors

```css
[data-theme="dark"] {
  --color-background:      #0F0F0F;
  --color-surface:         #1A1A1A;
  --color-surface-elevated:#242424;

  --color-text-primary:    #FAFAFA;
  --color-text-secondary:  #A1A1AA;
  --color-text-tertiary:   #71717A;

  --color-border:          #27272A;
  --color-border-subtle:   #1F1F23;

  --color-gold-50:         #1C1A0F;
  --color-gold-100:        #2A2510;
}
```

---

## Typography

### Font Stack

```css
:root {
  /* Display & Headlines - Outfit */
  --font-display: 'Outfit', 'Vazirmatn', system-ui, sans-serif;

  /* Body Text - Work Sans */
  --font-body: 'Work Sans', 'Vazirmatn', system-ui, sans-serif;

  /* Numbers & Prices - Geist Mono (tabular figures) */
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;

  /* Persian Fallback */
  --font-persian: 'Vazirmatn', 'IRANSans', 'Tahoma', sans-serif;
}
```

### Type Scale

| Element | Size | Weight | Line Height | Font |
|---------|------|--------|-------------|------|
| **H1** - Page Title | 32px / 2rem | 700 | 1.2 | Display |
| **H2** - Section Title | 24px / 1.5rem | 600 | 1.25 | Display |
| **H3** - Card Title | 18px / 1.125rem | 600 | 1.3 | Display |
| **H4** - Subsection | 16px / 1rem | 600 | 1.4 | Display |
| **Body** | 14px / 0.875rem | 400 | 1.5 | Body |
| **Body Small** | 12px / 0.75rem | 400 | 1.5 | Body |
| **Price Large** | 28px / 1.75rem | 700 | 1.1 | Mono |
| **Price Medium** | 20px / 1.25rem | 600 | 1.2 | Mono |
| **Price Small** | 14px / 0.875rem | 500 | 1.3 | Mono |
| **Label** | 11px / 0.6875rem | 500 | 1.4 | Body |
| **Caption** | 10px / 0.625rem | 400 | 1.5 | Body |

### Persian Typography

```css
[dir="rtl"] {
  font-family: var(--font-persian);
  letter-spacing: 0; /* No letter spacing for Persian */
}

/* Persian number formatting */
.price-persian {
  font-feature-settings: "ss01" on; /* Persian numerals if available */
}
```

---

## Spacing System

```css
:root {
  --space-0:   0;
  --space-1:   4px;    /* 0.25rem */
  --space-2:   8px;    /* 0.5rem */
  --space-3:   12px;   /* 0.75rem */
  --space-4:   16px;   /* 1rem */
  --space-5:   20px;   /* 1.25rem */
  --space-6:   24px;   /* 1.5rem */
  --space-8:   32px;   /* 2rem */
  --space-10:  40px;   /* 2.5rem */
  --space-12:  48px;   /* 3rem */
  --space-16:  64px;   /* 4rem */
  --space-20:  80px;   /* 5rem */
}
```

### Border Radius

```css
:root {
  --radius-none: 0;
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  24px;
  --radius-full: 9999px;
}
```

---

## Shadows & Elevation

```css
:root {
  /* Subtle elevation for cards */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);

  /* Default card shadow */
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.06),
               0 1px 2px rgba(0, 0, 0, 0.04);

  /* Elevated elements (dropdowns, modals) */
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08),
               0 2px 8px rgba(0, 0, 0, 0.04);

  /* Focus ring */
  --shadow-focus: 0 0 0 3px rgba(212, 175, 55, 0.2);

  /* Gold glow for best deals */
  --shadow-gold: 0 0 0 1px var(--color-gold-200),
                 0 4px 12px rgba(212, 175, 55, 0.15);
}
```

---

## Component Specifications

### 1. Price Card

The core component displaying a platform's gold price.

```
┌─────────────────────────────────────────┐
│  [Platform Logo]  Platform Name    •••  │  ← Header with menu
├─────────────────────────────────────────┤
│                                         │
│  گرم طلای ۱۸ عیار                       │  ← Gold type (Persian)
│  18K Gold Gram                          │  ← Gold type (English)
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ خرید / Buy  │  │ فروش / Sell │       │
│  │ ۱۵۰,۵۶۹,۰۰۰│  │ ۱۴۹,۳۷۰,۰۰۰│       │  ← Prices in mono font
│  │ 150,569,000 │  │ 149,370,000 │       │
│  └─────────────┘  └─────────────┘       │
│                                         │
│  اختلاف: ۱,۱۹۹,۰۰۰ ریال                 │  ← Spread
│  آخرین بروزرسانی: ۱۵:۰۱                  │  ← Last update
│                                         │
│  [▲ +2.5%]                              │  ← Change indicator
└─────────────────────────────────────────┘

Size: min-width 280px, flexible width
Padding: 20px
Border: 1px solid var(--color-border)
Border-radius: 12px
Background: var(--color-surface)
Shadow: var(--shadow-md)
```

**States**:
- **Default**: Standard appearance
- **Best Deal**: Gold border glow (`--shadow-gold`), subtle gold background
- **Loading**: Skeleton animation
- **Error**: Red border, error message

### 2. Comparison Table

Side-by-side platform comparison.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  پلتفرم        │  خرید (Buy)     │  فروش (Sell)   │  اختلاف    │  تغییر  │
│  Platform      │                 │                │  Spread    │  Change │
├──────────────────────────────────────────────────────────────────────────┤
│ ★ Taline       │  ۱۵۰,۵۶۹,۰۰۰   │  ۱۴۹,۳۷۰,۰۰۰  │  ۱,۱۹۹,۰۰۰│  ▲ 2.5% │  ← Best deal row
│                │  150,569,000    │  149,370,000   │  1,199,000 │         │
├──────────────────────────────────────────────────────────────────────────┤
│   Technogold   │  ۱۵۰,۸۰۰,۰۰۰   │  ۱۴۹,۵۰۰,۰۰۰  │  ۱,۳۰۰,۰۰۰│  ▲ 2.3% │
│                │  150,800,000    │  149,500,000   │  1,300,000 │         │
└──────────────────────────────────────────────────────────────────────────┘

Best Deal Row:
- Background: var(--color-best-deal-bg)
- Left border: 3px solid var(--color-best-deal)
- Star icon in gold

Table:
- Header bg: var(--color-background)
- Row hover: var(--color-gold-50)
- Border: 1px solid var(--color-border)
- Cell padding: 16px
```

### 3. Price Trend Chart

Interactive line chart for historical prices.

```
┌──────────────────────────────────────────────────────────────────┐
│  روند قیمت / Price Trend                    [۷ روز][۳۰ روز][سال]│
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ۱۵۵,۰۰۰ ┤                           ╱╲                          │
│          │                          ╱  ╲        ╱╲               │
│  ۱۵۰,۰۰۰ ┤        ╱╲    ╱╲        ╱    ╲      ╱  ╲              │
│          │       ╱  ╲  ╱  ╲      ╱      ╲    ╱    ╲    ╱        │
│  ۱۴۵,۰۰۰ ┤──────╱────╲╱────╲────╱────────╲──╱──────╲──╱─        │
│          │                                                       │
│          └───────┴───────┴───────┴───────┴───────┴───────┴──────│
│            شنبه    یکشنبه   دوشنبه   سه‌شنبه  چهارشنبه  پنجشنبه   جمعه │
│                                                                  │
│  ● Taline ─── Technogold                                        │
└──────────────────────────────────────────────────────────────────┘

Colors:
- Taline line: var(--color-gold-400)
- Technogold line: #6366F1 (Indigo)
- Grid lines: var(--color-border-subtle)
- Axis text: var(--color-text-tertiary)
- Tooltip bg: var(--color-surface-elevated) with shadow-lg
```

### 4. Price Alert Card

For the alerts feature.

```
┌─────────────────────────────────────────────────────────────────┐
│  🔔  هشدار قیمت / Price Alert                           [×]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  نوع طلا: گرم ۱۸ عیار                                           │
│  Gold Type: 18K Gram                                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  وقتی قیمت   [▼ کمتر شد از]   ۱۴۸,۰۰۰,۰۰۰   ریال         │  │
│  │  When price  [▼ drops below]  148,000,000   IRR          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  پلتفرم: [همه پلتفرم‌ها ▼]                                       │
│                                                                 │
│  [ ایجاد هشدار / Create Alert ]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Button:
- Primary button style
- Background: var(--color-gold-400)
- Hover: var(--color-gold-500)
- Text: white
- Border-radius: 8px
- Padding: 12px 24px
```

### 5. Best Deal Badge

Highlights the cheapest platform.

```
┌──────────────────────────────┐
│  ★ بهترین قیمت / Best Deal  │
└──────────────────────────────┘

Style:
- Background: var(--color-best-deal-bg)
- Border: 1px solid var(--color-best-deal)
- Text: var(--color-best-deal)
- Font-size: 11px
- Font-weight: 600
- Padding: 4px 8px
- Border-radius: 6px
- Star icon: var(--color-gold-400)
```

### 6. Language Toggle

Bilingual switch component.

```
┌─────────────────────────┐
│  [FA فارسی] │ [EN]     │
└─────────────────────────┘

Active state:
- Background: var(--color-gold-400)
- Text: white

Inactive state:
- Background: transparent
- Text: var(--color-text-secondary)
- Hover: var(--color-gold-50)

Container:
- Border: 1px solid var(--color-border)
- Border-radius: 8px
- Overflow: hidden
```

### 7. Stats Card (KPI)

For dashboard overview metrics.

```
┌─────────────────────────────────┐
│  بالاترین قیمت امروز            │  ← Label
│  Today's High                   │
│                                 │
│  ۱۵۵,۲۰۰,۰۰۰                    │  ← Large number
│  155,200,000 IRR                │
│                                 │
│  ▲ ۲,۳۰۰,۰۰۰ از دیروز           │  ← Comparison (green)
│    +2,300,000 from yesterday    │
└─────────────────────────────────┘

Size: Flexible, min-width 200px
Padding: 20px
Border-radius: 12px
Background: var(--color-surface)
```

---

## Layout Structure

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │  [Logo]  طلافی / Talafee          [🔔 Alerts] [FA/EN] [☀/🌙] [⚙]      │ │  ← Header (64px)
│ └────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│  │ قیمت فعلی │ │ بالاترین │ │ پایین‌ترین│ │ میانگین  │  ← Stats Row         │
│  │ ۱۴۹,۳۷۰  │ │ ۱۵۵,۲۰۰ │ │ ۱۴۵,۸۰۰ │ │ ۱۵۰,۵۰۰ │                      │
│  │ ▲ 2.5%   │ │          │ │          │ │          │                      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                      │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │                                                                       ││
│  │                    Price Trend Chart                                  ││  ← Main Chart
│  │                    (نمودار روند قیمت)                                  ││
│  │                                                                       ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │         Taline                  │  │        Technogold               │ │  ← Platform Cards
│  │         Price Card              │  │        Price Card               │ │
│  └─────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │                    Comparison Table                                   ││  ← Full Comparison
│  │                    (جدول مقایسه)                                       ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```css
/* Mobile first approach */
:root {
  --breakpoint-sm:  640px;   /* Small tablets */
  --breakpoint-md:  768px;   /* Tablets */
  --breakpoint-lg:  1024px;  /* Small laptops */
  --breakpoint-xl:  1280px;  /* Desktops */
  --breakpoint-2xl: 1536px;  /* Large screens */
}
```

### Grid System

```css
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding-inline: var(--space-4);
}

@media (min-width: 768px) {
  .container {
    padding-inline: var(--space-6);
  }
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Cards grid */
.cards-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .cards-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## Animation & Motion

### Timing Functions

```css
:root {
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Common Transitions

```css
/* Default transition */
.transition-default {
  transition: all 150ms var(--ease-out);
}

/* Color/background only */
.transition-colors {
  transition: color 150ms var(--ease-out),
              background-color 150ms var(--ease-out),
              border-color 150ms var(--ease-out);
}

/* Transform animations */
.transition-transform {
  transition: transform 200ms var(--ease-spring);
}
```

### Price Update Animation

```css
@keyframes price-flash {
  0% { background-color: transparent; }
  50% { background-color: var(--color-gold-100); }
  100% { background-color: transparent; }
}

.price-updated {
  animation: price-flash 600ms var(--ease-out);
}

@keyframes price-up {
  0% { color: var(--color-text-primary); }
  50% { color: var(--color-success); }
  100% { color: var(--color-text-primary); }
}

@keyframes price-down {
  0% { color: var(--color-text-primary); }
  50% { color: var(--color-danger); }
  100% { color: var(--color-text-primary); }
}
```

### Skeleton Loading

```css
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-border-subtle) 0%,
    var(--color-border) 50%,
    var(--color-border-subtle) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}
```

---

## Iconography

### Icon Set
Use **Lucide Icons** (or Heroicons) for consistency.

### Key Icons

| Icon | Usage |
|------|-------|
| `trending-up` | Price increase |
| `trending-down` | Price decrease |
| `bell` | Alerts |
| `settings` | Settings |
| `sun` / `moon` | Theme toggle |
| `globe` | Language |
| `refresh-cw` | Refresh/sync |
| `star` | Best deal |
| `clock` | Last updated |
| `chart-line` | Price trend |
| `table` | Comparison table |
| `coins` | Gold types |

### Icon Sizing

| Size | Pixels | Usage |
|------|--------|-------|
| xs | 12px | Inline with small text |
| sm | 16px | Default inline icons |
| md | 20px | Button icons |
| lg | 24px | Card header icons |
| xl | 32px | Empty states |

---

## RTL Support

### Direction Classes

```css
[dir="rtl"] {
  /* Flip horizontal margins/paddings */
  --space-start: var(--space-inline-end);
  --space-end: var(--space-inline-start);
}

/* Logical properties for automatic RTL */
.card {
  margin-inline-start: var(--space-4);
  padding-inline: var(--space-4);
  border-inline-start: 3px solid var(--color-gold-400);
}

/* Icons that need flipping */
[dir="rtl"] .icon-flip {
  transform: scaleX(-1);
}
```

### Bidirectional Text

```css
/* Mixed content handling */
.price-container {
  direction: ltr; /* Numbers always LTR */
  unicode-bidi: isolate;
}

/* Persian labels */
.label-persian {
  direction: rtl;
  text-align: right;
}
```

---

## Accessibility

### Focus States

```css
:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root {
    --color-border: #000000;
    --color-text-secondary: #4B5563;
  }
}
```

### ARIA Labels

- All interactive elements have descriptive labels
- Price changes announced to screen readers
- Live regions for real-time updates
- Skip navigation link for keyboard users

### Color Contrast

All text meets WCAG 2.1 AA standards:
- Large text (24px+): 3:1 minimum
- Normal text: 4.5:1 minimum
- UI components: 3:1 minimum

---

## File Structure (Planned)

```
talafee/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Homepage/Dashboard
│   │   ├── globals.css         # Global styles
│   │   └── [locale]/           # i18n routes
│   │
│   ├── components/
│   │   ├── ui/                 # Base UI components (shadcn)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   └── ...
│   │   ├── price/              # Price-specific components
│   │   │   ├── price-card.tsx
│   │   │   ├── price-table.tsx
│   │   │   ├── price-chart.tsx
│   │   │   └── price-badge.tsx
│   │   ├── layout/             # Layout components
│   │   │   ├── header.tsx
│   │   │   ├── footer.tsx
│   │   │   └── sidebar.tsx
│   │   └── features/           # Feature components
│   │       ├── alerts/
│   │       ├── comparison/
│   │       └── settings/
│   │
│   ├── lib/                    # Utilities
│   │   ├── utils.ts
│   │   ├── formatters.ts       # Price formatting
│   │   └── i18n.ts             # Internationalization
│   │
│   ├── hooks/                  # Custom hooks
│   │   ├── use-prices.ts
│   │   ├── use-theme.ts
│   │   └── use-locale.ts
│   │
│   ├── styles/                 # Style system
│   │   ├── tokens.css          # Design tokens
│   │   └── animations.css
│   │
│   └── types/                  # TypeScript types
│       └── index.ts
│
├── public/
│   ├── fonts/                  # Custom fonts
│   └── icons/
│
├── messages/                   # i18n messages
│   ├── fa.json
│   └── en.json
│
└── tailwind.config.ts          # Tailwind with design tokens
```

---

## Summary

| Aspect | Choice |
|--------|--------|
| **Style** | Modern Minimal with gold accents |
| **Colors** | Neutral grays + Gold (#D4AF37) accent |
| **Typography** | Outfit (display) + Work Sans (body) + Geist Mono (prices) |
| **Fonts (Persian)** | Vazirmatn |
| **Components** | shadcn/ui + Radix UI |
| **Charts** | Recharts or D3.js |
| **Icons** | Lucide Icons |
| **Layout** | CSS Grid + Flexbox |
| **RTL** | Full support with CSS logical properties |
| **Dark Mode** | Supported |
| **Accessibility** | WCAG 2.1 AA compliant |

---

*Design Specification v1.0 - Talafee Gold Price Comparison*
