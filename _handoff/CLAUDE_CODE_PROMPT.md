# Prompt to paste into Claude Code

Paste the text below into Claude Code, opened in an **empty folder** that contains this `design_handoff_apartqn/` bundle.

---

Build the ApartQN website from the design handoff in `design_handoff_apartqn/`. Read `design_handoff_apartqn/README.md` completely first. The `.dc.html` files are HTML design references; recreate them as real components and do not copy their template syntax.

Stack: Next.js (App Router, TypeScript), CSS custom properties from the README tokens plus CSS Modules, `next/font` Noto Sans (vietnamese + cyrillic subsets), deploy target Vercel.

Do it in this order and stop for my review after each step:

1. **Scaffold.** Create the Next.js app, `globals.css` with every token, the Noto Sans font, the `[locale]` routing (vi at `/`, `/en`, `/ru`) and the `i18n/{vi,en,ru}.json` files ported from the `T` table in `design/apartqn-data.js`.
2. **Data layer.** Create `data/buildings.ts`, `data/listings.ts`, `lib/format.ts`, `lib/filters.ts` and `lib/contacts.ts`, ported 1:1 from `apartqn-data.js`. Keep a single source of truth, and keep the DEMO flag on the data.
3. **Shared components.** Build Header (with the language listbox and the full-screen mobile drawer), Footer, SearchBar, FilterSheet/FilterSidebar, ListingCard, BuildingCard, CostBreakdown, ContactBox + MobileContactBar, ViewingRequestForm and ConsignForm. Follow the responsive table in the README exactly (breakpoints 768 / 1024, padding 16/24/32, 44px tap targets, 16px inputs).
4. **Pages.** Build Home, Results (with the URL-synced filters and the list/map view), Listing detail, Building and Consign. Use SSG with `generateStaticParams` and `generateMetadata`.
5. **Leads.** Add `app/api/lead/route.ts` with zod validation, Resend and a honeypot field. Email goes to `LEAD_TO_EMAIL` (phanhuutuan1010@gmail.com). Consign photos travel as attachments or as Vercel Blob links. Return clear error codes.
6. **SEO/PWA.** Add sitemap, robots, hreflang alternates, the manifest and icons.
7. **QA.** Test at 360 / 390 / 768 / 1024 / 1280 in vi and ru. Check for zero horizontal scroll, that Vietnamese diacritics in bold headings are not clipped, and that the contact buttons are correct per locale. Run Lighthouse mobile (target ≥ 90 Performance).
8. **Git.** Initialise git, add `.gitignore` (`.env*`, `.vercel`, `node_modules`, `.next`), commit, and follow `design_handoff_apartqn/DEPLOY.md`.

Rules:
- Never invent real prices, addresses or ward names. Keep the placeholders and the DEMO badge until the admin panel exists.
- Red (#D52B1E) is used only for the primary CTA and prices.
