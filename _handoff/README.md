# Handoff: ApartQN — long-term apartment rentals, Quy Nhon (PWA)

## Overview
ApartQN lists long-term rentals (minimum 6 months) in 8 central Quy Nhon buildings. The site is mobile-first and ships in 3 languages: **vi** (default), **en** and **ru**.
Screens: Home · Results (list/map) · Listing detail · Building · Consign (owner submission).
Goal: tenants can compare apartments by their **real monthly cost**, then contact via their locale's messenger or book a viewing.

## About the design files
The `.dc.html` files in `design/` are **design references built in HTML**. They are prototypes that show the intended look, content and behaviour; they are **not production code**. They use a proprietary template runtime (`support.js`, `<dc-import>`, `<sc-for>`, `<sc-if>`, `{{ holes }}`), so **do not copy that syntax**.
Your task is to **recreate these designs in Next.js (App Router, TypeScript)** with ordinary React components.
- Open any `design/*.dc.html` in a browser to see it live; `support.js` must sit next to the files.
- `design/apartqn-data.js` is the **single source** for demo data, i18n strings, formatters, the filter logic and the layout helper. Port it 1:1 into TypeScript modules (see "Data & i18n").

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, shadows, copy (vi/en/ru) and interactions are final. Recreate them pixel-accurately.
Placeholders that are **not** final:
- photos
- maps and building pins
- ward names (`Phường —`)
- demo listings (every screen shows a `DỮ LIỆU DEMO` badge)

The owner will fill these later from an **admin panel** (see "Phase 2").

---

## Recommended stack
- **Next.js 14+ App Router**, TypeScript, deployed on **Vercel**.
- Styling: global CSS custom properties (`app/globals.css`, tokens below) plus CSS Modules. Mirror the tokens 1:1; no Tailwind theme mapping required.
- i18n routes: `/` = vi, `/en/...`, `/ru/...` via a `[locale]` segment (or middleware), with `hreflang` alternates.
- Font: **Noto Sans** via `next/font/google`, subsets `latin`, `latin-ext`, `vietnamese`, `cyrillic`, weights 400/500/600/700/800.
- Images: `next/image`, aspect-ratio boxes (no layout shift), lazy-loaded below the fold. Maps are lazy-loaded (click-to-load or IntersectionObserver).
- PWA: `manifest.webmanifest` plus icons. Add offline caching later; it is not required for launch.

## Routes

| Route | Design file | Notes |
|---|---|---|
| `/` | `Home.dc.html` | SSG |
| `/can-ho` (en `/apartments`, ru `/kvartiry`) | `Results.dc.html` | Filters live in query params (below) |
| `/can-ho/[code]` e.g. `/can-ho/qn-001` | `Listing Detail.dc.html` | SSG, `generateStaticParams` from data |
| `/toa-nha/[id]` | `Building.dc.html` | SSG |
| `/ky-gui` | `Consign.dc.html` | form → API |
| `/api/lead` | — | POST, sends email (below) |

The prototype uses `?code=` / `?id=` query strings only because it has no router. Use real path segments.

---

## Responsive system (must match)
Layout switches on **viewport width** (CSS media queries). The prototype measures its own width only because it is embedded in a canvas.

| | < 768 (sm) | 768–1023 (md) | ≥ 1024 (lg) |
|---|---|---|---|
| Side padding | 16 | 24 | 32 |
| Container | content max **1200px**, centred | | |
| Header | 60px: logo · `VI ▾` · ☰ (tagline hidden < 400px) | 60px, same | 72px: logo+tagline · nav · `VI ▾` · outlined "Ký gửi căn hộ" |
| Hero (Home) | text → SearchBar → image | same, image 16:9 | 2 cols (text 680px max, image 4:3), SearchBar full width below |
| SearchBar | 3 selects stacked + full-width red button + "Thêm bộ lọc" link | 2×2 selects + full button | one row: 4 selects + button |
| Listing grid | 1 col | 2 col | 3 col (Results with sidebar: 3 if col ≥ 260px, else 2) |
| Building grid | 2 col | 3 col | 4 col |
| Filters | bottom sheet, sticky Apply footer | bottom sheet | sidebar 264px, applies instantly |
| Detail gallery | swipe carousel (scroll-snap) with "1 / 12" counter | 1 large + 4 grid | 1 large + 4 grid |
| Contact | sticky bottom bar | sticky bottom bar | sticky right column 380px (top 96px) |

Breakpoints to test: **360 / 390 / 768 / 1024 / 1280**. **Zero horizontal scroll** in vi **and** ru (ru is about 30% longer). Carousels scroll only inside their own track.
- Tap targets ≥ 44px everywhere: buttons, chips, filter pills, nav rows, footer links, card arrows (44px hit area around a 32px visual circle).
- Inputs use 16px font (prevents iOS zoom). Labels sit above inputs. Forms are 1 column on mobile; name + phone go 2-up on tablet.
- Headings: `line-height ≥ 1.15` plus `padding-top: .08em` so stacked Vietnamese diacritics (ề ể ố ộ ữ) never clip.
- Keep phrases together with no-break spaces: `dài hạn`, `trung tâm`, `Quy Nhơn`. They are already in the strings as `\u00A0`.

### Mobile contact bar (Listing detail, < 1024)
Sticky to the bottom, white, 1px top border, shadow `0 -6px 20px rgba(16,24,40,.08)`, padding `10px {side} calc(10px + env(safe-area-inset-bottom))`.
Grid `64px 64px 1fr`, gap 8:
1. **Call**: icon + label `Gọi / Call / Звонок`, `tel:` link.
2. **Messenger for the locale**: vi **Zalo**, en **WhatsApp**, ru **Telegram**. WhatsApp and Telegram links prefill the message with the listing code.
3. **Price block** (links to `#viewing`, the viewing form): red `#D52B1E`, radius 14, height 60, shadow `0 6px 18px rgba(213,43,30,.28)`. Small caps `CHO THUÊ / FOR RENT / АРЕНДА` (11px/600, tracking .08em) over `13,5 triệu` (21px/800) + `/tháng` (14px/600).

Icons are 26px blue `#0039A6` line icons (2px stroke). Use a proper icon set (e.g. Lucide `Phone`, `MessageCircle`) or official brand marks when licensed.

---

## Design tokens
```css
:root{
  /* blue — brand, links, secondary buttons, selection */
  --blue-50:#EEF3FC; --blue-100:#D9E4F7; --blue-200:#B3C8EF; --blue-500:#0039A6; --blue-600:#002F8A; --blue-700:#00256E; --blue-900:#001A4D;
  /* red — PRIMARY CTA + PRICE ONLY (~5% of surface) */
  --red-50:#FCECEA; --red-500:#D52B1E; --red-600:#B82217; --red-700:#9C1C12;
  /* neutrals */
  --ink-900:#141821; --ink-heading:#0B1530; --gray-700:#3A404C; --gray-500:#687080; --gray-300:#C9CED6; --gray-200:#E3E6EB; --gray-150:#EEF0F3; --gray-100:#F1F3F6; --gray-50:#F7F8FA; --white:#FFFFFF;
  /* status badges (fg/bg) */
  --ok-fg:#1E7F4F; --ok-bg:#E6F4EC; --warn-fg:#8A5200; --warn-bg:#FDF0D8; --muted-fg:#4A5160; --muted-bg:#EDEFF2; --error:#B42318;
  /* radius */
  --r-sm:8px; --r-md:10px; --r-card:12px; --r-panel:16px; --r-sheet:20px; --r-pill:999px;
  /* shadow */
  --sh-card:0 1px 2px rgba(16,24,40,.06),0 4px 16px rgba(16,24,40,.06);
  --sh-panel:0 8px 32px rgba(16,24,40,.08);
  --sh-search:0 12px 40px rgba(16,24,40,.14),0 1px 3px rgba(16,24,40,.08);
  --sh-sheet:0 24px 60px rgba(11,21,48,.28);
  /* spacing scale */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-6:24px; --s-8:32px; --s-12:48px;
  --font:'Noto Sans',system-ui,sans-serif;
}
```
**Type scale** (Noto Sans):

| Style | Size | Weight | Line height | Tracking | Other |
|---|---|---|---|---|---|
| H1 | `clamp(30px,4.5vw,56px)` | 800 | 1.15 | −0.025em | max 20ch, `text-wrap:balance`, colour `--ink-heading` |
| Detail H1 | `clamp(28px,3.4vw,40px)` | 800 | — | — | max 24ch |
| H2 | `clamp(24px,3vw,36px)` | 800 | 1.2 | −0.02em | — |
| Section H2 (detail) | 22px | 700 | — | — | — |
| Body | 16px | 400 | 1.6 | — | colour `--gray-700` for secondary |
| Card price | 19px | 800 | — | — | red; detail price 26px, box price 30px |
| Caption / label | 12–13px | 600–700 | — | — | uppercase eyebrows use tracking .08em |
| Code / demo badge | 11–12px | — | — | — | `ui-monospace` |

**Logo:** text lockup "**Apart**QN" (800 + 500, tracking −0.035em, blue). Localised tagline in 12px `--gray-500`. There is no red in the mark.

**Buttons:**
- Primary: red, radius 10, height 52 (48 in compact spots), 16px/700; hover `--red-600`, active `--red-700`.
- Secondary: 1.5px blue outline, blue text; hover `--blue-50`.
- Contact buttons are blue (filled for the first, outlined for the second) so red stays rare.

**Chips:** pill, min-height 44, 1.5px border `--gray-300`; selected = blue fill with white text.

**Badges:** 24–26px pill, 12px/600, nowrap. Status (available/reserved/rented) uses the status colours with a 6px dot. "✓ Đã xác minh" is white or `--blue-50` with blue text.

**Placeholders:** striped `repeating-linear-gradient(135deg,#E8ECF2 0 12px,#F1F4F8 12px 24px)` with a mono label. Replace them with real images.

---

## Screens

### Header (all pages)
Sticky, white, 1px bottom border.
- **≥1024:** nav items `Căn hộ · Toà nhà · Liên hệ` (15px, min-height 44, nowrap; the active item is blue/700).
- **Language button** `VI ▾` (44px, 1px `--gray-300` border, radius 10) opens a listbox with all 3 options (`VI Tiếng Việt / EN English / RU Русский`). The current option has a ✓. Clicking outside closes it.
- **Hamburger (<1024)** opens a **full-screen drawer**:
  - top row: logo + close button (44px round)
  - nav rows 48px, 18px/600
  - outlined "Ký gửi căn hộ" (52px)
  - "LIÊN HỆ" heading + 2 locale contact buttons (vi Zalo+Call · ru Telegram+WhatsApp · en WhatsApp+Telegram)
  - opening hours
- RU nav labels: `Квартиры · Здания · Контакты`, button `Сдать квартиру`.

### Home
Sections, in order:
1. Hero (eyebrow pill `Thuê dài hạn · tối thiểu 6 tháng` + DEMO pill, H1, sub, image, SearchBar)
2. Featured apartments (6 / 4 / 3 cards by breakpoint + "Xem tất cả →")
3. Buildings (grey band `#F7F8FA`, 8 building cards: name, street, "N căn đang cho thuê", "từ X triệu/tháng")
4. Why ApartQN (3 columns, 2px blue top rule)
5. Consign CTA (blue-50 panel, red button)
6. Footer

Keep Home light: no heavy client components above the fold. The filter sheet loads on demand.

### Results
- Title + DEMO badge.
- Sticky toolbar under the header:
  - Filters button with a count badge (<1024 only)
  - selects for building / rent (rent hidden when the sidebar shows it) / sort
  - List | Map segmented control
- Row under the toolbar: result count, removable filter pills (×), "Xoá bộ lọc", checkbox "Hiện căn đã cho thuê".
- **Filters:** bedrooms (Studio/1/2/3+), rent (4 ranges), furniture (3), pets toggle, car parking toggle (**no data yet**, admin will add it), move-in date (≤ date).
- **Sort:** recently updated (default) / price ↑ / price ↓ / earliest move-in. Rented listings always sort last and are hidden by default.
- **Map (lg):** list (1 col) + sticky map (640px tall). Pins show the lowest rent of each building and the listing count. Clicking a pin filters the list to that building and shows a card with "Xem toà nhà".
- **Map (<lg):** 440px map, then a horizontal card carousel.
- Empty state: dashed box, copy, "Xoá bộ lọc".
- **All filter state lives in the URL:** `?b=&beds=&rent=r0..r3&furn=&pets=1&date=YYYY-MM-DD&rented=1&sort=low|high|move&view=map`. The filter logic is `match()` in `apartqn-data.js`.

### Listing detail
In order:
1. breadcrumb (lg)
2. gallery
3. status / verified / demo badges
4. H1 (`2 phòng ngủ · View biển`)
5. building · address, code + updated date
6. price block (<lg)
7. Key facts (8 tiles: 2 / 4 cols)
8. **Monthly cost breakdown** (`CostBreakdown`: rent + management + motorbike parking + internet = estimated total; excludes electricity/water; car parking optional)
9. Rental terms (12 rows, 1 / 2 cols)
10. In-unit amenities
11. Building amenities + "Xem toà nhà →"
12. Location map
13. Viewing request form (<lg, `id="viewing"`)
14. Similar apartments (closest rent)

The lg aside holds ContactBox (price, estimated monthly cost, move-in, 2 locale buttons, prefilled message preview), the "hoặc đặt lịch xem" divider, then the viewing form.

### Building
Gallery (facade/pool/lobby), badges, H1, address, rent range. Then:
- apartments for rent (or an empty message)
- building amenities
- **Building fees**: management ₫/m²/month, motorbike and car parking ranges, derived from listings in that building
- location map
- aside "Hỏi về toà nhà này" with the 2 locale buttons + prefilled message and a link to Results filtered by the building
- other buildings

### Consign
Blue-50 hero: eyebrow, H1, sub, 4 numbered steps. The form sits in the right column on lg and stacks on mobile. Below: a grid of accepted buildings.

**Form fields:**
- building (select)
- floor / area m² / bedrooms (3 equal columns)
- asking rent
- photos (drop zone; shows "✓ N ảnh")
- owner name, phone

On success, show a confirmation card with "Gửi yêu cầu khác".

---

## Interactions & state
- **Locale:** from the route; the switch keeps the current page. Formatters are in `apartqn-data.js`: money `13.500.000 ₫`, short `13,5 triệu / 13.5M ₫ / 13,5 млн ₫`, Russian plurals `pl()`, dates via `toLocaleDateString`.
- **Contact per locale** (`contacts()`):

  | Locale | Buttons | Messenger (mobile bar) |
  |---|---|---|
  | vi | Zalo + Call | Zalo |
  | ru | Telegram + WhatsApp | Telegram |
  | en | WhatsApp + Telegram | WhatsApp |

  WhatsApp and Telegram get `?text=` with the listing code (`F.msg`), building name (`F.msgB`) or a generic message (`F.msgG`). **Replace the demo numbers:** `tel:+84900000000`, `zalo.me/0900000000`, `wa.me/84900000000`, `t.me/apartqn`.
- **Card photo slider:** ‹ › step through photos without navigating; dots show 5 max.
- **Viewing form:** name*, phone*, preferred date, duration chips (6 / 12 / >12 months).
  - While submitting: "Đang gửi…", button disabled.
  - On error: red line `sendErr`.
  - On success: green box "✓ Đã nhận yêu cầu · QN-001".
- **Filter sheet:** local draft; the red button reads "Xem N căn" (live count) and applies on click. "Đặt lại" clears the draft.

## Leads → email (production)
The prototype posts to FormSubmit from the browser. **In production, replace this with a Next.js route `app/api/lead/route.ts`:**
- Validate with zod.
- Send via **Resend** to `LEAD_TO_EMAIL`.
- Accept **photo attachments** for consign (resize on the client to ≤ 1600px, max 20 files, reject over 4 MB total or upload to Vercel Blob and email the links).
- Return specific errors (`missing_config`, `send_failed`, `invalid_input`) so production issues are easy to diagnose.
- Add a honeypot field and a simple rate limit.

Environment variables:
```
RESEND_API_KEY=...
LEAD_TO_EMAIL=phanhuutuan1010@gmail.com
LEAD_FROM_EMAIL=ApartQN <leads@your-domain>   # domain verified in Resend
NEXT_PUBLIC_SITE_URL=https://...
```
Email subjects: `[ApartQN] Đặt lịch xem QN-001` and `[ApartQN] Ký gửi căn hộ · <building>`. The body is a key/value table in Vietnamese, plus the visitor's locale and the page URL.

## Data & i18n
Port `design/apartqn-data.js` into:
- `data/buildings.ts`: `{ id, name, street, ward?, lat?, lng?, amenities: ('pool'|'gym'|'security'|'lift'|'basement'|'mart'|'kids')[] }`
- `data/listings.ts`: `{ code, buildingId, floor, area, beds, baths, dir, view, furn:'full'|'basic'|'empty', rent, deposit(months), cycle:'m1'|'m3', mgmt, elec:'evn'|'fixed', water:'meter'|'person', moto, car, net, minTerm, maxOcc, pets, tempReg, verified, video, status:'available'|'reserved'|'rented', moveIn, updated, photos:string[], carParking?:boolean }`
- `i18n/{vi,en,ru}.json`: from the `T` table (`[vi, en, ru]` triples)
- `lib/format.ts` (money, mil, dates, plurals), `lib/filters.ts` (`match`, sort)

The estimated monthly total is `rent + mgmt + moto + net`. Keep it in one function.

## SEO / performance
- `generateMetadata` per listing: `"{beds} phòng ngủ · {view} – {building}, {rent}/tháng | ApartQN"`, plus Open Graph with the first photo.
- `app/sitemap.ts` and `app/robots.ts` generated from the data, with `alternates.languages` for vi/en/ru.
- Target a Lighthouse mobile score of ≥ 90 for Performance and ≥ 95 for Accessibility. Home should have no client JS except the header, SearchBar and filter sheet.

## Phase 2: admin panel (owner already asked for this)
The owner will manage photos, map coordinates, ward names, the car-parking flag, listings and statuses.
- Put it behind a password: `ADMIN_PASSWORD` env var, httpOnly session cookie, middleware on `/admin/*`, `noindex`.
- Vercel's filesystem is **read-only**. "Publish" must **commit the JSON/data and images through the GitHub REST API** (`GITHUB_TOKEN` with contents:write on this repo, `GITHUB_REPO`, `GITHUB_BRANCH`). The site updates after the redeploy (~1 minute), so tell the admin exactly that.
- Draft → preview with the real components → publish. Keep a backup of the previous file on every publish.

## Files in this bundle
`design/`, all openable in a browser:
- **Pages:** `Home.dc.html`, `Results.dc.html`, `Listing Detail.dc.html`, `Building.dc.html`, `Consign.dc.html`
- **Components:** `SiteHeader`, `SiteFooter`, `SearchBar`, `FilterDrawer` (sheet/sidebar), `ListingCard`, `BuildingCard`, `CostBreakdown`, `ContactBox` (box/bar), `ViewingRequestForm`, `ConsignForm` (all `.dc.html`)
- **Tokens:** `Design System.dc.html` (§00 has the responsive rules)
- **Data, strings, logic:** `apartqn-data.js`
- **Review canvases:** `ApartQN Review.dc.html`, `ApartQN Review EN.dc.html`, `ApartQN Review Responsive.dc.html`
- **Prototype runtime:** `support.js` (needed only to open the references)

`screenshots/` — full-length PNG captures (1x) named `<screen>-<locale>-<width>.png`: home (vi 390/768/1280, ru 390), listing (vi 390/768/1280, ru 390/1280), results (vi 390 list, vi 1280 map, ru 1280 list), building (vi 390/1280), consign (vi 390), header states (ru 390 menu open, ru 1280 language open). Use them for visual comparison; the `.dc.html` files remain the source of truth for exact values. Note: the listing-detail meta line ("Mã căn: QN-001") must not wrap mid-code — fixed in the design files after capture.

See `CLAUDE_CODE_PROMPT.md` for the kickoff prompt and `DEPLOY.md` for GitHub + Vercel.
