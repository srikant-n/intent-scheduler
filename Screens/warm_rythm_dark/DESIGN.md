---
name: Intent Scheduler Dark
colors:
  surface: '#121318'
  surface-dim: '#121318'
  surface-bright: '#38393e'
  surface-container-lowest: '#0d0e13'
  surface-container-low: '#1a1b20'
  surface-container: '#1e1f24'
  surface-container-high: '#292a2f'
  surface-container-highest: '#34343a'
  on-surface: '#e3e2e9'
  on-surface-variant: '#e2bfb2'
  inverse-surface: '#e3e2e9'
  inverse-on-surface: '#2f3035'
  outline: '#a98a7e'
  outline-variant: '#5a4138'
  surface-tint: '#ffb599'
  primary: '#ffb599'
  on-primary: '#5a1c00'
  primary-container: '#f66018'
  on-primary-container: '#4f1700'
  inverse-primary: '#a73a00'
  secondary: '#ffb690'
  on-secondary: '#552100'
  secondary-container: '#ec6a06'
  on-secondary-container: '#4a1c00'
  tertiary: '#7bd0ff'
  on-tertiary: '#00354a'
  tertiary-container: '#009bd1'
  on-tertiary-container: '#002d40'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb599'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#7f2b00'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#121318'
  on-background: '#e3e2e9'
  surface-variant: '#34343a'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes a focused, immersive workspace tailored for sustained desktop productivity and deep work. Balancing the tactile intimacy of editorial layouts with modern Windows desktop acrylic surfaces, it couples deep slate-charcoal foundations with warm, luminous typography and incandescent terracotta focal points.

### Personality & Emotional Response
- **Nocturnal & Focused:** Recedes gracefully to let primary content and high-density information lead without causing visual fatigue.
- **Warm & Tactile:** Replaces sterile, cold monochromatic blacks with rich midnight charcoal and glowing ember highlights, instilling comfort during long operational sessions.
- **Architectural & Layered:** Leverages subtle translucency, selective acrylic blurs, and crisp micron-level perimeter keylines to create clean desktop depth.

### Design Movement & Aesthetic Direction
A modern hybrid of **Desktop Glassmorphism (Fluent/Acrylic)** and **Warm Editorial Precision**:
- Surfaces employ graded midnight-to-slate elevation with backdrop blur on overlay panels, flyouts, and command bars.
- 1px crisp borders define bounds cleanly without relying on diffuse, murky shadow pools.
- Micro-interactions emit gentle ember glows rather than stark synthetic white pulses.

## Colors

The palette is engineered specifically for elevated dark mode clarity, eliminating halation while maintaining energetic tactical feedback across complex workflows.

### Primary Canvas & Layering Tokens
- **Background / Canvas Base:** `#121316` — Deep midnight slate foundation.
- **Surface Container (Level 1 / Cards):** `#18191e` — Structural workspace surface.
- **Surface Container High (Level 2 / Modals, Active Cards):** `#22242a` — Raised desktop windows and popovers.
- **Acrylic Glass Tint:** `rgba(24, 25, 30, 0.72)` with `backdrop-filter: blur(20px) saturate(180%)`.
- **Border Stroke Neutral:** `#2d3139` — Subdued structural boundaries.
- **Border Stroke Active / Focus:** `rgba(249, 115, 22, 0.45)`.

### Typographic Contrast Hierarchy
- **Primary Text:** `#f3f4f6` — Warm off-white, optimized for sustained reading contrast.
- **Muted / Secondary Text:** `#9ca3af` — Neutral slate grey for secondary metadata, timestamps, and column labels.
- **Tertiary / Disabled Text:** `#6b7280` — De-emphasized cues and inactive states.

### Core Accents
- **Primary Accent (Warm Terracotta):** `#ea580c` — Grounded, rich burnt orange for active buttons, key indicators, and selected states.
- **Secondary Accent (Terracotta Glow):** `#f97316` — Luminous highlight variant used for hover transitions, active badges, and focus rings.

### Tactical Category Indicators
High-chroma, balanced tones calibrated for high visibility over `#18191e`:
- **Amber (Urgent / Active):** `#fbbf24` (Subtle tint container: `rgba(251, 191, 36, 0.12)`)
- **Emerald (Success / Verified):** `#34d399` (Subtle tint container: `rgba(52, 211, 153, 0.12)`)
- **Indigo (Analytical / System):** `#818cf8` (Subtle tint container: `rgba(129, 140, 248, 0.12)`)
- **Rose (Critical / Alert):** `#fb7185` (Subtle tint container: `rgba(251, 113, 133, 0.12)`)

## Typography

Typography is set exclusively in **Plus Jakarta Sans**, exploiting its wide aperture and crisp geometric strokes to deliver optimal legibility against dark slate surfaces.

### Scale Application & Rules
- **Headline XL / LG:** Applied to primary document views, dashboard headers, and critical modal views. Uses tighter letter-spacing to prevent visual float on wide desktop displays.
- **Headline MD / SM:** Used for section headers, card titles, and panel division headers.
- **Body MD:** The default reading size for longform prose, editor documents, and data tables. Generous line height (22px on 14px size) ensures sustained visual clarity without ocular strain.
- **Label Tokens:** Applied across interactive controls, data tags, metrics, and navigation rails. `label-sm` utilizes an uppercase transformation paired with generous letter-spacing (+0.04em) for immediate visual classification in status badges.

## Layout & Spacing

The system follows an adaptable 12-column layout tailored for desktop dashboard efficiency with responsive collapse for sidecar panels and mobile views.

### Desktop Rhythm & Layout Rules
- **Grid Architecture:** 12-column fluid grid governed by a 4px baseline unit. Outer margins scale to `2rem` (32px) on desktop viewpoints (min-width: 1024px) with `1.5rem` (24px) gutters between panes.
- **Fixed-to-Fluid Shell:** Desktop interfaces utilize a fixed navigation rail (72px collapsed or 240px expanded) paired with an optional fixed context pane (320px) and a fluid central viewport.
- **Component Padding Scale:**
  - `space-xs` (4px): Micro-gaps between badge icons and text; icon button internal clearance.
  - `space-sm` (8px): Standard compact stack gap; input field vertical padding; table row gutters.
  - `space-md` (16px): Card standard internal padding; list group separation; flyout margins.
  - `space-lg` (24px): Primary modal padding; major layout segment divisions.
  - `space-xl` (40px): Section breaks in long-form reports; empty-state vertical buffer.

## Elevation & Depth

Visual hierarchy does not rely on blurry drop shadows, which can muddy dark backgrounds. Instead, elevation is rendered through **tonal surface escalation, acrylic diffusion, and 1px interior highlight strokes**.

### Tiers of Depth

1. **Tier 0 (Root Workspace / Canvas):**
   - Solid `#121316`. No blur, no elevation.
2. **Tier 1 (Resting Cards & Panels):**
   - Solid `#18191e` or Acrylic Glass (`rgba(24, 25, 30, 0.75)` with `backdrop-filter: blur(16px)`).
   - Border: 1px solid `#2d3139`.
   - Shadow: `0 1px 2px rgba(0, 0, 0, 0.3)`.
3. **Tier 2 (Floating Windows, Modals, Menus, Hovered Cards):**
   - Fill: `#22242a` with `backdrop-filter: blur(24px) saturate(190%)`.
   - Border: 1px solid `rgba(243, 244, 246, 0.12)`.
   - Shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.55), 0 4px 12px -2px rgba(0, 0, 0, 0.35)`.
4. **Tier 3 (Active Focus & Accent Halo):**
   - Interactive focus layers use an ember-tinted ambient glow: `0 0 0 1px #ea580c, 0 0 16px -2px rgba(234, 88, 12, 0.35)`.

## Shapes

The interface embraces an 8px (`0.5rem`) default curvature, pairing structural desktop order with soft, comfortable tactile corners.

### Shape Hierarchy
- **Standard Controls (0.5rem / 8px):** Buttons, text fields, dropdown trigger buttons, check toggles, and contextual menus.
- **Structural Containers (1rem / 16px - `rounded-lg`):** Dashboard cards, data panels, dialog modals, and slide-over sidebars.
- **Featured / Hero Elements (1.5rem / 24px - `rounded-xl`):** Onboarding containers and detached acrylic toolbar docks.
- **Pill Elements (`rounded-full`):** Category tags, count indicators, avatar badges, and status pills.

## Components

### Buttons
- **Primary:** Background `#ea580c`, color `#ffffff`, border none. Hover: `#f97316` with ambient glow `0 0 14px rgba(249, 115, 22, 0.3)`. Active: scale `0.98`.
- **Secondary / Acrylic:** Background `rgba(34, 36, 42, 0.65)`, color `#f3f4f6`, border `1px solid #2d3139`. Hover: background `#22242a`, border `rgba(243, 244, 246, 0.2)`.
- **Ghost:** Background transparent, color `#9ca3af`. Hover: background `rgba(243, 244, 246, 0.05)`, color `#f3f4f6`.

### Inputs & Form Fields
- Height 40px, corner radius 8px.
- Background `#18191e`, border `1px solid #2d3139`, text `#f3f4f6`, placeholder `#6b7280`.
- Focus: Border `#ea580c`, ring `0 0 0 1px #ea580c`, background `#121316`.

### Checkboxes & Radios
- Size 18x18px, corner radius 4px (checkbox) or 50% (radio).
- Unchecked: Border `1.5px solid #2d3139`, background `#121316`.
- Checked: Background `#ea580c`, border `#ea580c`, glyph color `#ffffff`.

### Chips & Tactical Badges
- Corner radius `9999px`, height 24px, font `label-sm`.
- **Amber:** Fill `rgba(251, 191, 36, 0.12)`, text `#fbbf24`, border `1px solid rgba(251, 191, 36, 0.25)`.
- **Emerald:** Fill `rgba(52, 211, 153, 0.12)`, text `#34d399`, border `1px solid rgba(52, 211, 153, 0.25)`.
- **Indigo:** Fill `rgba(129, 140, 248, 0.12)`, text `#818cf8`, border `1px solid rgba(129, 140, 248, 0.25)`.
- **Rose:** Fill `rgba(251, 113, 133, 0.12)`, text `#fb7185`, border `1px solid rgba(251, 113, 133, 0.25)`.

### Cards & Data Panels
- Background `#18191e`, corner radius 16px (`rounded-lg`), border `1px solid #2d3139`.
- Internal padding: `space-md` (16px) or `space-lg` (24px).
- Hoverable Card: Transitions border color to `rgba(243, 244, 246, 0.18)` and elevation to Tier 2.

### Lists & Tables
- List items have 8px radius on hover with background `rgba(243, 244, 246, 0.03)`.
- Table header: Text `#9ca3af`, font `label-md`, uppercase, border-bottom `1px solid #2d3139`.
- Row cells: Height 48px, text `#f3f4f6`, border-bottom `1px solid rgba(45, 49, 57, 0.6)`.