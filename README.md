# ApartQN

Long-term apartment rentals in central Quy Nhơn — Next.js 16 (App Router) · TypeScript · CSS Modules · next-intl (vi / en / ru) · Vercel.

Design handoff (spec, tokens, prototypes, screenshots, deploy notes): [`_handoff/`](_handoff/README.md).

## Run

```bash
npm install
cp .env.example .env.local   # fill in what you need
npm run dev                  # http://localhost:3000
npm run build && npm start   # production check
```

## Structure

| Path | What |
|---|---|
| `app/[locale]/…` | Pages: Home, `can-ho` (results), `can-ho/[code]`, `toa-nha/[id]`, `ky-gui`. All SSG. |
| `app/api/lead` | Viewing / consign leads → Resend email + Telegram (either may be configured). |
| `app/api/upload` | Vercel Blob client-upload tokens for consign photos. |
| `app/sitemap.ts`, `robots.ts`, `manifest.ts` | SEO + PWA, generated from the repo. |
| `components/` | UI components (one CSS Module each). |
| `data/` | `buildings.ts`, `listings.ts`, `site.ts` (contacts, `DEMO` flag). **Demo data.** |
| `lib/repo.ts` | The only data access layer — swap files for Supabase here. |
| `lib/format.ts`, `filters.ts`, `contacts.ts` | Ported 1:1 from `_handoff/design/apartqn-data.js`. |
| `i18n/` | `vi/en/ru.json`, routing (vi unprefixed, `/en`, `/ru`, localized slugs). |
| `public/images/buildings/<id>/NN.webp` | Building photos. |
| `app/fonts/` | Self-hosted Noto Sans subset (see its README). |

## Lead API errors

`INVALID` (400) · `RATE_LIMITED` (429) · `CONFIG_MISSING` (500) · `SEND_FAILED` (502, with per-channel detail). Success needs at least one channel (email or Telegram) to deliver.

Deploy: see [`_handoff/DEPLOY.md`](_handoff/DEPLOY.md).
