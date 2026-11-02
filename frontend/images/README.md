# La Extravaganza - Images

Every photo the site uses, as **WebP**: 23 photos, about 2.8 MB in total, including the small card versions. The photos come from **Unsplash** and **Pexels** and are free to use under their licences.

## Files

| File                                | Where it appears                                   | Source                                        |
| ----------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| `hero/home-hero.webp`               | Home page hero (loads first, not lazy)             | Unsplash / Pexels                             |
| `hero/about-hero.webp`              | About page hero                                    | Unsplash / Pexels                             |
| `hero-exterior.webp`                | Home page, the building                            | Unsplash · `photo-1566073771259-6a8506099945` |
| `concierge-editorial.webp`          | Home page concierge section, 404 page background   | Unsplash · `photo-1578683010236-d716f9a3f461` |
| `login-interior.webp`               | Login page side image                              | Unsplash · `photo-1611892440504-42a792e24d32` |
| `featured-tier-1-bedroom.webp`      | Home page, large tier card                         | Unsplash · `photo-1611892440504-42a792e24d32` |
| `featured-tier-2-twin-suite.webp`   | Home page, tier card                               | Unsplash · `photo-1582719478250-c89cae4dc85b` |
| `featured-tier-3-luxury-bed.webp`   | Home page, tier card                               | Unsplash · `photo-1618773928121-c32242e63f39` |
| `tiers/floor-N/x.webp`              | Room photos (see below)                            | Unsplash / Pexels                             |
| `tiers/floor-N/x-640.webp`          | 640px copy of each room photo, for cards           | made by `npm run images`                      |
| `favicon.svg`                       | Browser tab icon                                   | drawn for the site                            |

## Room photos by tier

Room photos live in `tiers/floor-N/` but are grouped by **tier** in `backend/data/tiers.json` (the folder number isn't the floor). No photo is shared between tiers:

| Floor | Tier      | Photos (the first leads the room page gallery)                                                    |
| ----- | --------- | ------------------------------------------------------------------------------------------------- |
| 1     | Garden    | `tiers/floor-3/b.webp`, `tiers/floor-4/b.webp`, `tiers/floor-2/c.webp`, `tiers/floor-1/a.webp`     |
| 2     | Classic   | `tiers/floor-4/a.webp`, `tiers/floor-2/b.webp`, `tiers/floor-5/a.webp`                             |
| 3     | Executive | `tiers/floor-3/a.webp`, `tiers/floor-1/c.webp`, `tiers/floor-5/b.webp`, `tiers/floor-4/c.webp`     |
| 4     | Penthouse | `tiers/floor-1/b.webp`, `tiers/floor-7/c.webp`, `tiers/floor-2/a.webp`, `tiers/floor-6/c.webp`     |

Each room in `backend/data/rooms.json` uses one photo from its own tier's set as its card image. The API adds the tier, with its photos, to every room it returns, so the Rooms page, room page, floor map and Aria all show the same pictures.

## How photos are loaded

- `UI.photo(src)` in `frontend/js/ui.js` builds every room photo tag. It sets `loading="lazy"`, plus a `srcset`, so a card downloads the 640px copy (30-60 KB) instead of the full photo.
- Images written directly in the HTML are lazy too, except the home page hero, which has `fetchpriority="high"`.
- The server tells browsers to keep images for a week (`backend/server.js`).

## Adding or changing a photo

1. Put the new photo in this folder as a JPG.
2. Run `npm run images -- --remove-originals`. This writes the `.webp` (at most 1600px wide, or 1200px for room photos), plus a `-640.webp` copy for room photos, then deletes the JPG.
3. Reference the `.webp` file in the page or in `tiers.json` / `rooms.json`.

## Licensing

- **Unsplash**: free under the [Unsplash License](https://unsplash.com/license). No attribution is required, but it's encouraged.
- **Pexels**: free under the [Pexels License](https://www.pexels.com/license/). No attribution is required.

Both licences allow commercial and non-commercial use.
