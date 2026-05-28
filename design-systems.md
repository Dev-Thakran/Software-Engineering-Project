# LuxStay - Complete Design System

A reference document for every colour, font family, and font size used across the LuxStay hotel booking website.

---

## 1. Colour Palette

The entire site uses a single warm cream-and-brown palette. Tokens are defined in `tailwind.config.js` under `colors.lux.*`.

### Brand colours

| Token            | Hex       | Usage                                                      |
| ---------------- | --------- | ---------------------------------------------------------- |
| `lux-cream`      | `#FAF7F2` | Page background; light text on dark surfaces               |
| `lux-cream-dark` | `#F2EBE1` | Alternate section background (editorial split, table head) |
| `lux-white`      | `#FFFFFF` | Card / widget surfaces                                     |
| `lux-brown-100`  | `#E6DFD7` | Default borders, dividers                                  |
| `lux-brown-200`  | `#D4C4B0` | Input bottom-borders, light tints                          |
| `lux-brown-300`  | `#B89F89` | Scrollbar thumb, mid-tone                                  |
| `lux-brown-400`  | `#9A826A` | Hover border on cards                                      |
| `lux-brown-500`  | `#8B7355` | Muted text, labels, overlines, chart axis ticks            |
| `lux-brown-600`  | `#6B5743` | Body text on light background, secondary text              |
| `lux-brown-700`  | `#4A3B32` | **Primary** - buttons, primary text, focus borders         |
| `lux-brown-800`  | `#2C241B` | Heading text, footer background, "in residence" badge      |
| `lux-brown-900`  | `#1A140F` | Deepest accent (modal overlays use `bg-lux-brown-900/50`)  |
| `lux-gold`       | `#C9A961` | **Single accent** - review stars only                      |

### Recharts chart palette (Manager dashboard)

A five-tint progression of the same brown family for cohesion across all charts:

`#4A3B32` · `#6B5743` · `#8B7355` · `#B89F89` · `#D4C4B0`

### Functional colours

| Use case               | Colour                        |
| ---------------------- | ----------------------------- |
| Error text             | `text-red-700`                |
| Error background       | `bg-red-50`                   |
| Error border           | `border-red-200`              |
| Body / page background | `#FAF7F2`                     |
| Text selection         | `#4A3B32` bg / `#FAF7F2` text |

---

## 2. Typography

Three Google Fonts, loaded via `@import` in `src/index.css`:

```css
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;1,400;1,500&display=swap");
```

### Font families

| Family                 | Type                      | Weights                 | Used for                                                                                                                                                                                                     |
| ---------------------- | ------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cormorant Garamond** | Serif (display)           | 300, 400, 500, 600, 700 | All headings H1–H3, large display numbers, big KPIs, card titles                                                                                                                                             |
| **Outfit**             | Sans-serif (UI)           | 300, 400, 500, 600      | All body text, labels, buttons, navigation, form inputs, table data, chart text                                                                                                                              |
| **Playfair Display**   | Serif italic (decorative) | 400 italic, 500 italic  | Decorative italic flourishes inside headings - the _"Stay"_ in the logo, _"a world unto itself"_, _"devotion"_, _"like a novel"_, etc. Always paired with Cormorant via `<span class="font-display italic">` |

A browser-default **monospace** font is used in exactly one place: the card-number / expiry / CVV inputs on the booking page.

### Tailwind utility classes

```js
fontFamily: {
  serif:   ['"Cormorant Garamond"', 'serif'],
  sans:    ['"Outfit"', 'system-ui', 'sans-serif'],
  display: ['"Playfair Display"', 'serif'],
}
```

Use: `font-serif`, `font-sans`, `font-display` in JSX.

---

## 3. Typographic scale

Sizes are written as **Tailwind class → actual pixel value** (assuming default root size of 16px = 1rem).

### Global vocabulary

| Role                                 | Tailwind class                                    | Mobile  | Desktop  |
| ------------------------------------ | ------------------------------------------------- | ------- | -------- |
| Overline / kicker (uppercase)        | `text-xs tracking-[0.3em]` or `tracking-[0.22em]` | 12px    | 12px     |
| Tiny label (form labels, table head) | `text-xs tracking-[0.22em] uppercase`             | 12px    | 12px     |
| Small body / nav links               | `text-sm`                                         | 14px    | 14px     |
| Body                                 | `text-base` or `text-lg`                          | 16px    | 16–18px  |
| H4 / card title (serif)              | `text-xl` to `text-2xl`                           | 20–24px | 20–24px  |
| H3 / section subhead (serif)         | `text-3xl`                                        | 30px    | 30px     |
| H2 (serif)                           | `text-3xl lg:text-4xl`                            | 30px    | 36px     |
| Page title H1 (serif)                | `text-5xl lg:text-6xl` or `lg:text-7xl`           | 48px    | 60–72px  |
| Hero / display (serif)               | `text-5xl sm:text-6xl lg:text-8xl`                | 48px    | 96–128px |
| Big stat number (KPI)                | `text-5xl` / `text-6xl` / `text-7xl`              | 48–72px | 48–72px  |

### Tailwind size reference

| Class       | Pixels |
| ----------- | ------ |
| `text-xs`   | 12px   |
| `text-sm`   | 14px   |
| `text-base` | 16px   |
| `text-lg`   | 18px   |
| `text-xl`   | 20px   |
| `text-2xl`  | 24px   |
| `text-3xl`  | 30px   |
| `text-4xl`  | 36px   |
| `text-5xl`  | 48px   |
| `text-6xl`  | 60px   |
| `text-7xl`  | 72px   |
| `text-8xl`  | 96px   |

---

## 4. Page-by-page typography

### 🏠 Home

| Element                             | Class                                | Size            | Family       |
| ----------------------------------- | ------------------------------------ | --------------- | ------------ |
| Hero H1                             | `text-5xl sm:text-6xl lg:text-8xl`   | 48 → 96 → 128px | Cormorant    |
| Hero subline                        | `text-base sm:text-lg`               | 16 → 18px       | Outfit light |
| Hero kicker "An Auckland Sanctuary" | `text-xs tracking-[0.3em] uppercase` | 12px            | Outfit       |
| Intro stat numbers (48, 8, 4.9)     | `text-5xl`                           | 48px            | Cormorant    |
| Section H2 "Ascend through tiers"   | `text-4xl lg:text-6xl`               | 36 / 60px       | Cormorant    |
| Tier card titles                    | `text-3xl lg:text-4xl`               | 30 / 36px       | Cormorant    |
| Editorial split H2                  | `text-4xl lg:text-6xl`               | 36 / 60px       | Cormorant    |
| Testimonial quote                   | `text-3xl lg:text-5xl italic`        | 30 / 48px       | Cormorant    |

### 🛏️ Browse Rooms

| Element                | Class                  | Size      | Family    |
| ---------------------- | ---------------------- | --------- | --------- |
| H1 "Rooms & Suites"    | `text-5xl lg:text-7xl` | 48 / 72px | Cormorant |
| Intro body             | `text-lg`              | 18px      | Outfit    |
| Card "Room 101"        | `text-2xl`             | 24px      | Cormorant |
| Card price             | `text-2xl`             | 24px      | Cormorant |
| Filter labels          | `text-xs uppercase`    | 12px      | Outfit    |
| Card amenity icons row | `text-xs`              | 12px      | Outfit    |

### 🏢 Floor Map

| Element                   | Class                           | Size      | Family    |
| ------------------------- | ------------------------------- | --------- | --------- |
| H1 "Floor Map"            | `text-5xl lg:text-7xl`          | 48 / 72px | Cormorant |
| Floor label "Penthouse"   | `text-xl`                       | 20px      | Cormorant |
| Room number cell          | `text-[10px] tracking-[0.18em]` | 10px      | Outfit    |
| Hover preview room number | `text-3xl`                      | 30px      | Cormorant |
| Hover price               | `text-xl`                       | 20px      | Cormorant |

### 🚪 Room Detail

| Element            | Class                  | Size      | Family    |
| ------------------ | ---------------------- | --------- | --------- |
| Page H1 "Room 801" | `text-5xl lg:text-6xl` | 48 / 60px | Cormorant |
| Section H2         | `text-4xl`             | 36px      | Cormorant |
| Price big          | `text-5xl`             | 48px      | Cormorant |
| Review title       | `text-xl`              | 20px      | Cormorant |
| Amenity list items | `text-sm`              | 14px      | Outfit    |

### 🔐 Login

| Element                  | Class                                 | Size      | Family    |
| ------------------------ | ------------------------------------- | --------- | --------- |
| H1 "Sign in"             | `text-4xl lg:text-5xl`                | 36 / 48px | Cormorant |
| Role tab labels          | `text-xs tracking-[0.18em] uppercase` | 12px      | Outfit    |
| Input text               | `text-base`                           | 16px      | Outfit    |
| Demo credential rows     | `text-sm`                             | 14px      | Outfit    |
| Right-panel display text | `text-4xl`                            | 36px      | Cormorant |

### 📝 Register

| Element              | Class       | Size | Family    |
| -------------------- | ----------- | ---- | --------- |
| H1 "Begin your stay" | `text-4xl`  | 36px | Cormorant |
| Form inputs          | `text-base` | 16px | Outfit    |

### 💳 Booking

| Element                              | Class                                 | Size | Family    |
| ------------------------------------ | ------------------------------------- | ---- | --------- |
| H1 "Secure your stay"                | `text-5xl`                            | 48px | Cormorant |
| Step labels (1 - Dates, 2 - Payment) | `text-xs tracking-[0.22em] uppercase` | 12px | Outfit    |
| Card preview number                  | `text-2xl tracking-widest`            | 24px | Cormorant |
| Summary total                        | `text-3xl`                            | 30px | Cormorant |
| Pay button                           | `text-xs tracking-[0.22em] uppercase` | 12px | Outfit    |

### ✅ Confirmation

| Element               | Class                  | Size      | Family    |
| --------------------- | ---------------------- | --------- | --------- |
| H1 "Thank you, Guest" | `text-5xl lg:text-6xl` | 48 / 60px | Cormorant |
| Body                  | `text-lg`              | 18px      | Outfit    |
| Reference number      | `text-2xl`             | 24px      | Cormorant |
| "Total paid" amount   | `text-2xl`             | 24px      | Cormorant |

### 📚 My Bookings

| Element                    | Class                  | Size      | Family    |
| -------------------------- | ---------------------- | --------- | --------- |
| H1 "My stays"              | `text-5xl lg:text-6xl` | 48 / 60px | Cormorant |
| Section H2                 | `text-3xl`             | 30px      | Cormorant |
| Card room title            | `text-2xl`             | 24px      | Cormorant |
| Review modal H "Reviewing" | `text-3xl`             | 30px      | Cormorant |

### 👤 My Profile

| Element      | Class               | Size | Family    |
| ------------ | ------------------- | ---- | --------- |
| H1           | `text-5xl`          | 48px | Cormorant |
| Field labels | `text-xs uppercase` | 12px | Outfit    |
| Input        | `text-base`         | 16px | Outfit    |

### 🧑‍💼 Staff Dashboard

| Element                       | Class                    | Size    | Family    |
| ----------------------------- | ------------------------ | ------- | --------- |
| H1 "Good evening, Amelia"     | `text-5xl`               | 48px    | Cormorant |
| Live clock                    | `text-3xl`               | 30px    | Cormorant |
| Shift timer / counter (big)   | `text-5xl` to `text-6xl` | 48–72px | Cormorant |
| Section H2 "Guests awaiting…" | `text-3xl`               | 30px    | Cormorant |
| Guest name in queue           | `text-xl`                | 20px    | Cormorant |
| Body / data                   | `text-sm`                | 14px    | Outfit    |
| Action buttons                | `text-xs uppercase`      | 12px    | Outfit    |

### 📊 Manager Dashboard

| Element                     | Class                 | Size | Family    |
| --------------------------- | --------------------- | ---- | --------- |
| H1 "Operations at a glance" | `text-5xl`            | 48px | Cormorant |
| KPI numbers                 | `text-5xl`            | 48px | Cormorant |
| Chart title H3              | `text-3xl`            | 30px | Cormorant |
| Chart subtitle/kicker       | `text-xs uppercase`   | 12px | Outfit    |
| Table big-number cell       | `text-xl`             | 20px | Cormorant |
| Table body                  | `text-sm`             | 14px | Outfit    |
| Recharts axis ticks         | inline `fontSize: 11` | 11px | Outfit    |
| Recharts legend             | inline `fontSize: 11` | 11px | Outfit    |
| Review card title           | `text-xl`             | 20px | Cormorant |

### ℹ️ About

| Element                      | Class                  | Size       | Family    |
| ---------------------------- | ---------------------- | ---------- | --------- |
| Hero H1                      | `text-5xl lg:text-8xl` | 48 / 128px | Cormorant |
| Lead paragraph (serif)       | `text-3xl`             | 30px       | Cormorant |
| Body                         | `text-lg`              | 18px       | Outfit    |
| Stat numbers (2014, 52, 4.9) | `text-7xl`             | 72px       | Cormorant |

### 📨 Contact

| Element                    | Class                  | Size      | Family    |
| -------------------------- | ---------------------- | --------- | --------- |
| H1 "Our concierge awaits." | `text-5xl lg:text-7xl` | 48 / 72px | Cormorant |
| "Visit us." card H3        | `text-3xl`             | 30px      | Cormorant |
| Form input                 | `text-base`            | 16px      | Outfit    |

---

## 5. Navigation & footer (consistent across every page)

| Element                | Class                                 | Size | Family                      |
| ---------------------- | ------------------------------------- | ---- | --------------------------- |
| Logo "LuxStay"         | `text-3xl`                            | 30px | Cormorant + Playfair italic |
| Nav links              | `text-xs tracking-[0.22em] uppercase` | 12px | Outfit                      |
| Reserve button         | `text-xs tracking-[0.22em] uppercase` | 12px | Outfit                      |
| Footer H3 "LuxStay"    | `text-3xl`                            | 30px | Cormorant                   |
| Footer column headings | `text-xs tracking-[0.22em] uppercase` | 12px | Outfit                      |
| Footer body            | `text-sm`                             | 14px | Outfit light                |
| Footer copyright       | `text-xs`                             | 12px | Outfit                      |

---

## 6. Other consistent design tokens

| Token               | Value                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Border radius**   | `0px` everywhere (`rounded-none`). Strictly architectural.                                                                          |
| **Borders**         | `1px solid #E6DFD7` (lux-brown-100). No drop shadows.                                                                               |
| **Letter-spacing**  | `tracking-[0.22em]` for uppercase overlines/buttons; `tracking-[0.3em]` for hero kickers; `tracking-tighter` for big serif headings |
| **Transitions**     | `transition-colors duration-300` (links/buttons); `duration-[1200ms]` (image hover zoom)                                            |
| **Selection**       | Background `#4A3B32`, foreground `#FAF7F2`                                                                                          |
| **Scrollbar thumb** | `#B89F89` with `#FAF7F2` track                                                                                                      |
| **Cursor**          | Default system; pointer on interactives                                                                                             |
| **Image hover**     | `scale(1.04)` over 1200ms ease-out                                                                                                  |

### Spacing rhythm

| Use case             | Tailwind padding                                                  |
| -------------------- | ----------------------------------------------------------------- |
| Section (vertical)   | `py-24 lg:py-32`                                                  |
| Section (horizontal) | `px-6 lg:px-12`                                                   |
| Card                 | `p-6` to `p-10`                                                   |
| Dashboard widget     | `p-8`                                                             |
| Max content width    | `max-w-[1600px]` (marketing pages), `max-w-[1400px]` (dashboards) |

### Buttons

| Variant   | Classes                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary   | `px-8 py-4 bg-lux-brown-700 text-lux-cream text-xs tracking-[0.22em] uppercase hover:bg-lux-brown-800`                                     |
| Secondary | `px-8 py-4 border border-lux-brown-700 text-lux-brown-700 text-xs tracking-[0.22em] uppercase hover:bg-lux-brown-700 hover:text-lux-cream` |
| Ghost     | `text-xs tracking-[0.22em] uppercase text-lux-brown-500 hover:text-lux-brown-800`                                                          |

### Inputs

| Style           | Classes                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Text/email/date | `w-full bg-transparent border-b border-lux-brown-200 py-3 focus:border-lux-brown-700 focus:outline-none text-lux-brown-800` |
| Textarea        | `w-full bg-transparent border border-lux-brown-200 p-3 focus:border-lux-brown-700 focus:outline-none resize-none`           |
| Label           | `text-xs tracking-[0.22em] uppercase text-lux-brown-500 block mb-2`                                                         |

---

## 7. Quick reference - copy/paste cheat sheet

```css
/* Brand colours as CSS variables */
--lux-cream: #faf7f2;
--lux-cream-dark: #f2ebe1;
--lux-white: #ffffff;
--lux-brown-100: #e6dfd7;
--lux-brown-200: #d4c4b0;
--lux-brown-300: #b89f89;
--lux-brown-400: #9a826a;
--lux-brown-500: #8b7355;
--lux-brown-600: #6b5743;
--lux-brown-700: #4a3b32; /* primary */
--lux-brown-800: #2c241b; /* heading */
--lux-brown-900: #1a140f;
--lux-gold: #c9a961; /* accent (stars only) */

/* Fonts */
font-family-heading: "Cormorant Garamond", serif;
font-family-body: "Outfit", system-ui, sans-serif;
font-family-accent: "Playfair Display", serif; /* italic only */

/* Border radius */
border-radius: 0;

/* Standard border */
border: 1px solid #e6dfd7;
```

---

_Document version 1.0 · LuxStay design system · Cream, brown, and white luxury hospitality theme._
