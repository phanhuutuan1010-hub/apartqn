# Deploy: GitHub + Vercel

## 1. GitHub
```bash
git init && git add . && git commit -m "ApartQN initial build"
gh repo create apartqn --private --source=. --push      # or create the repo on github.com and:
# git remote add origin https://github.com/<user>/apartqn.git && git branch -M main && git push -u origin main
```
Never commit `.env.local`. Check that `.gitignore` covers `.env*`.

## 2. Vercel
1. Go to vercel.com → Add New → Project → Import the `apartqn` repo (framework is detected as Next.js).
2. Settings → Environment Variables. Add them for **Production and Preview**:
   - `RESEND_API_KEY`
   - `LEAD_TO_EMAIL=phanhuutuan1010@gmail.com`
   - `LEAD_FROM_EMAIL` (sender on a domain verified in Resend)
   - `NEXT_PUBLIC_SITE_URL`
   - Later, for the admin panel: `ADMIN_PASSWORD`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`
3. Deploy. From then on, every push to `main` deploys automatically, and pull requests get preview URLs.
4. Domain: Settings → Domains → add the domain, then set the DNS records (A `76.76.21.21` / CNAME `cname.vercel-dns.com`).

## Common problems
- **Environment variable added but the form still fails:** new or changed variables only apply after a **redeploy** (Deployments → ⋯ → Redeploy). Check that you added it to the right environment (Production vs Preview) and that the value has no stray quotes or spaces.
- **Resend `from` is rejected:** the sender domain must be verified in Resend (DNS SPF/DKIM). Before that, you can only send from `onboarding@resend.dev`, and only to your own account email.
- **Admin "publish" works locally but fails on Vercel:** the filesystem is read-only in production. Publish must go through the GitHub Contents API. If the GitHub token is expired or scoped to the wrong repo, the error is 401/403/404, so regenerate a fine-grained token with Contents: Read & Write on this repo.
- **Images:** host them in `public/` or Vercel Blob. Don't hotlink.
- After deploying, **send one real test** of each form on the production domain and confirm the email arrives in the inbox (check spam too).

## Before announcing the domain
- Real phone, Zalo, WhatsApp and Telegram contacts replace the demo numbers.
- DEMO badges are removed only from data that has been verified.
- Mobile has no horizontal scroll at 360px.
- Lighthouse mobile scores ≥ 90.
- Sitemap and robots are reachable.
- Both forms have been tested on production.
