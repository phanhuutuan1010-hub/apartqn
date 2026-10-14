-- ApartQN · 35 · notifications_log: every attempt to tell staff about a lead (Telegram / e-mail) and how it ended.
-- A failed or impossible notification is no longer silent: admins see "Thông báo lỗi: N" on Hôm nay.
-- Written by the server only (service role); admins read. No message text is stored.
create table public.notifications_log (
  id bigint generated always as identity primary key,
  lead_id uuid references public.leads (id) on delete set null,
  channel text not null check (channel in ('telegram', 'email')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text check (error is null or length(error) <= 500),
  created_at timestamptz not null default now()
);
create index notifications_log_created_idx on public.notifications_log (created_at desc);
create index notifications_log_lead_idx on public.notifications_log (lead_id);
alter table public.notifications_log enable row level security;
revoke all on public.notifications_log from anon, authenticated;
grant select on public.notifications_log to authenticated;
grant all on public.notifications_log to service_role;
create policy notifications_log_admin_read on public.notifications_log for select to authenticated using ((select private.is_admin()));
