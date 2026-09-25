# ApartQN

Long-term apartment rentals in central Quy Nhơn — Next.js 16 (App Router) · TypeScript · CSS Modules · next-intl (vi / en / ru) · Supabase · Vercel.

Design handoff (spec, tokens, prototypes, screenshots, deploy notes): [`_handoff/`](_handoff/README.md).

## Run

```bash
npm install
cp .env.example .env.local   # fill in (see comments in the file)
npm run db:migrate           # apply supabase/migrations to DATABASE_URL
npm run db:seed              # first time only: demo data + building photos → Supabase
npm run dev                  # http://localhost:3000 · admin: /admin
npm test                     # RLS / RPC / seed / unit tests (embedded Postgres, no Docker)
```

## Structure

| Path | What |
|---|---|
| `app/[locale]/…` | Public site: Home, `can-ho` (results), `can-ho/[code]`, `toa-nha/[id]`, `ky-gui`. ISR (on-demand + 1 h fallback). |
| `app/admin/…` | Staff admin (Vietnamese, invite-only). |
| `app/api/lead` | Website forms → `leads` / `consign_inbox` + Telegram / email. |
| `app/api/consign/upload` | One-time signed upload URLs into the private `consign-inbox` bucket. |
| `app/api/cron/daily` | Daily cron (keep-alive, availability reminders / auto-hide, Monday backup reminder). |
| `lib/repo.ts` | Public data access — reads only the `public_listings` / `public_buildings` views (publishable key). |
| `lib/supabase/` | `server.ts` (staff session, RLS) · `browser.ts` · `secret.ts` (server only, bypasses RLS). |
| `lib/admin/` | Admin server actions, labels, helpers. |
| `supabase/migrations/` | Schema, guard triggers, RLS, views, RPCs, storage policies. |
| `tests/` | `db/` RLS + RPC + seed tests on embedded Postgres 17 with a Supabase stub · `unit/`. |
| `scripts/` | `db-migrate.mts`, `seed.mts`, `create-admin.mts`. |
| `data/` | Handoff demo data — **seed input only**, the site never reads it. |
| `app/fonts/` | Self-hosted Noto Sans subset (see its README). |

## Admin (`/admin`)

**Accounts are invite-only.** Roles: `admin` (everything) and `sales` (only units/listings/leads assigned to them; owner data never visible to others). `can_publish` lets a sales member publish without approval. Locking an account (`active = false`) blocks it immediately in the proxy and in RLS.

| Page | |
|---|---|
| Tổng quan | pending approvals, listings needing "còn trống" confirmation, missing EN/RU translations, new leads, new consign requests, days since last backup (red after 7) |
| Căn hộ | table with URL filters/sort/pagination, quick status change, "✓ Còn trống"; form with unit / costs / terms / 🔒 owner source / photos / VI-EN-RU descriptions, duplicate check, "Đăng ngay" or "Gửi duyệt" |
| Duyệt tin | approve (assigns the permanent QN code) or reject with a reason |
| Chờ xử lý | website consign requests → assign to sales (creates unit + prefilled draft, copies photos as internal) or reject |
| Khách hàng | leads by status, notes timeline, reassign, manual lead |
| Toà nhà | wards (new/old), verified coordinates, amenities, default fees, descriptions, photos |
| Người dùng | invite, role, publishing right, lock, **Chuyển giao** (hand over all work), password-reset link |
| Cài đặt | **Xuất dữ liệu** (.zip: JSON + CSV UTF-8 BOM of units, listings, leads, profiles, buildings), reminder thresholds |
| Tài khoản | own name / phone / Telegram chat id + test message |

Public pages refresh immediately (`revalidatePath`) when a listing is published, its status/price/photos change, or a building is edited.

### First admin

```bash
npm run admin:create -- owner@example.com "Họ tên"
```
Prints a one-time link (24 h) to set the password. Run it again to get a new link.

### Supabase project settings (once)

- **Authentication → Sign In / Providers → Email:** turn **off** "Allow new users to sign up" (invites still work).
- **Authentication → URL Configuration → Site URL:** your production URL.
- Invite / reset emails are sent by the app through Resend using our own confirm link (`/admin/auth/confirm`), so Supabase's email templates and SMTP limits don't matter. Without Resend, admins get a copyable link.

### Notifications

- **Telegram:** create a bot with @BotFather → `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME`. Each staff member opens the bot, presses Start, and saves their chat id in **Tài khoản**. New leads go to the listing's assignee (fallback: admins, then `TELEGRAM_CHAT_ID`); consign requests go to admins.
- **Email:** `RESEND_API_KEY`, `LEAD_FROM_EMAIL` (verified domain), `LEAD_TO_EMAIL`.
- Website form data is always saved in the database first; notifications are best-effort.

### Daily cron

`vercel.json` runs `/api/cron/daily` at 01:00 UTC (08:00 in Vietnam) — Vercel Hobby allows one cron per day. Set `CRON_SECRET` in Vercel; Vercel sends it as `Authorization: Bearer …`.
- keep-alive query (Supabase Free pauses idle projects)
- `available` listings not confirmed for more than `verify_remind_days` (14) → Telegram reminder to the assignee
- more than `verify_hide_days` (21) → status `hidden` (removed from the site) + notification
- Mondays → backup reminder to admins

Manual run: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/daily`

### Descriptions & translations

Each listing/building has `desc_vi/en/ru`. A page only shows the description in its own language. When EN/RU (or VI) is missing, listing pages show a summary generated from structured fields via i18n templates (`sum*` keys) — Vietnamese text never appears on EN/RU pages. The admin table flags missing or outdated (older than VI) translations.

## API error codes (`/api/lead`)

`INVALID` (400) · `RATE_LIMITED` (429) · `CONFIG_MISSING` (500) · `SEND_FAILED` (502: not saved and no notification sent).

## Deploy

See [`_handoff/DEPLOY.md`](_handoff/DEPLOY.md) for GitHub + Vercel. In addition to it: set every key from `.env.example` except `DATABASE_URL` in Vercel, run `npm run db:migrate` against production before deploying new migrations, and complete the Supabase settings above.
