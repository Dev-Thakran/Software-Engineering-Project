# LuxStay - Image Asset Library

This folder contains every image used across the LuxStay hotel booking website (15 photos · ~3.3 MB total). All photos are sourced from **Unsplash** and **Pexels** and are free to use under their respective licences.

## Manifest

| Filename                         | Where it appears in the site                | Original source                               |
| -------------------------------- | ------------------------------------------- | --------------------------------------------- |
| `hero-exterior.jpg`              | Home page hero section (full-bleed)         | Unsplash · `photo-1566073771259-6a8506099945` |
| `about-hero-mountain.jpg`        | About page hero                             | Unsplash · `photo-1445019980597-93fa8acb246c` |
| `concierge-editorial.jpg`        | Home page editorial split section           | Unsplash · `photo-1578683010236-d716f9a3f461` |
| `login-interior.jpg`             | Login page left-half image                  | Unsplash · `photo-1611892440504-42a792e24d32` |
| `featured-tier-1-bedroom.jpg`    | Home - large featured tier card (Penthouse) | Unsplash · `photo-1611892440504-42a792e24d32` |
| `featured-tier-2-twin-suite.jpg` | Home - featured tier card (Ambassador)      | Unsplash · `photo-1582719478250-c89cae4dc85b` |
| `featured-tier-3-luxury-bed.jpg` | Home - featured tier card (Premier)         | Unsplash · `photo-1618773928121-c32242e63f39` |
| `room-bed-classic.jpg`           | Room grid (every 8th room)                  | Unsplash · `photo-1566665797739-1674de7a421a` |
| `room-bed-modern.jpg`            | Room grid                                   | Unsplash · `photo-1611892440504-42a792e24d32` |
| `room-bed-warm.jpg`              | Room grid                                   | Unsplash · `photo-1618773928121-c32242e63f39` |
| `room-bed-bright.jpg`            | Room grid                                   | Unsplash · `photo-1631049307264-da0ec9d70304` |
| `room-bed-soft.jpg`              | Room grid                                   | Unsplash · `photo-1590490360182-c33d57733427` |
| `room-bed-twin.jpg`              | Room grid                                   | Unsplash · `photo-1582719478250-c89cae4dc85b` |
| `room-bed-pexels-gold.jpg`       | Room grid (gold-accent room)                | Pexels · `18285947`                           |
| `room-bed-pexels-twin.jpg`       | Room grid (twin-bed room)                   | Pexels · `3688261`                            |

## How rooms are mapped

Each of the 48 rooms (8 floors × 6 rooms) is assigned an image by this formula in `src/lib/data.js`:

```js
image: ROOM_IMAGES[(floor + roomIndex) % ROOM_IMAGES.length];
```

This cycles through the 8 room images (`room-bed-*.jpg`) so every floor gets a varied mix.

## Image specifications

- **Format**: JPEG
- **Width**: 1200–2000 px (delivered via Unsplash/Pexels resize parameters)
- **Quality**: 80–85
- **Aspect ratios used in UI**:
  - Hero / About hero - full-bleed (~16:9 cropped)
  - Tier cards on Home - fluid (min-height 280–340px)
  - Room cards in grid - 4:3
  - Room detail header - 4:3
  - Concierge editorial - 4:5

## Licensing

- **Unsplash** images - Free under the [Unsplash License](https://unsplash.com/license). No attribution required, but encouraged.
- **Pexels** images - Free under the [Pexels License](https://www.pexels.com/license/). No attribution required.

Both licences permit commercial and non-commercial use.

## Using these images in your project

### Option A - keep the CDN URLs (current setup)

The site currently references the images directly from Unsplash/Pexels CDNs in `src/lib/data.js` and the page components. This is the fastest path and gives automatic image optimisation.

### Option B - self-host

If you want to host these images yourself:

1. Move this folder into `/app/frontend/public/images/`
2. Update references in the code from full URLs to local paths:
   ```js
   // before
   "https://images.unsplash.com/photo-1566073771259-...?auto=format&fit=crop&w=2000&q=80";
   // after
   "/images/hero-exterior.jpg";
   ```
3. Files to update:
   - `src/lib/data.js` - `ROOM_IMAGES` array
   - `src/pages/Home.jsx` - `HERO`, `IMG_A`, `IMG_B`, `IMG_C` constants
   - `src/pages/Login.jsx` - image `src` attribute
   - `src/pages/About.jsx` - image `src` attribute

---

_Last updated: 2026 · LuxStay image library_
