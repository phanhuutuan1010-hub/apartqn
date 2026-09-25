import 'server-only';
import { Resend } from 'resend';

/** Send a staff email through Resend when configured. Returns false when email is not set up. */
export async function sendStaffMail(to: string, subject: string, html: string): Promise<boolean> {
  const { RESEND_API_KEY, LEAD_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !LEAD_FROM_EMAIL) return false;
  const r = await new Resend(RESEND_API_KEY).emails.send({ from: LEAD_FROM_EMAIL, to, subject, html });
  if (r.error) {
    console.error('[mail] failed:', r.error);
    return false;
  }
  return true;
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Our own confirm URL (server-side verifyOtp), so links work without editing Supabase email templates. */
export const authLink = (tokenHash: string, type: 'invite' | 'recovery') =>
  `${siteUrl()}/admin/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;

export const authMailHtml = (title: string, body: string, link: string, cta: string) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#141821">
  <h2 style="color:#0039A6;margin:0 0 12px">${title}</h2>
  <p style="font-size:15px;line-height:1.55">${body}</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#0039A6;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">${cta}</a></p>
  <p style="font-size:13px;color:#687080">Link dùng một lần và hết hạn sau 24 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
</div>`;
