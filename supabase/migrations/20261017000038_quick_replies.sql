-- ApartQN · 38 · "Trả lời nhanh": message templates (RU / EN / VI) staff copy into Zalo / WhatsApp / Telegram.
-- Admin + sales read, add and edit; nobody deletes (hide = active false). updated_by / updated_at are stamped here.
-- Tokens {{price_studio}} {{price_1br}} {{price_2br}} render from settings.price_from_* (VND / month).
create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 1 and 40),
  title_vi text not null check (length(title_vi) between 1 and 200),
  usage_vi text check (usage_vi is null or length(usage_vi) <= 500),
  body_ru text check (body_ru is null or length(body_ru) <= 5000),
  body_en text check (body_en is null or length(body_en) <= 5000),
  body_vi text check (body_vi is null or length(body_vi) <= 5000),
  note_vi text check (note_vi is null or length(note_vi) <= 1000),
  sort int not null default 0,
  active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quick_replies_sort_idx on public.quick_replies (active, sort, code);

create function private.quick_replies_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  return new;
end $$;
create trigger stamp before insert or update on public.quick_replies for each row execute function private.quick_replies_stamp();

alter table public.quick_replies enable row level security;
revoke all on public.quick_replies from anon, authenticated;
grant select, insert, update on public.quick_replies to authenticated;
grant all on public.quick_replies to service_role;
create policy quick_replies_staff_read on public.quick_replies for select to authenticated using ((select private.is_staff()));
create policy quick_replies_staff_insert on public.quick_replies for insert to authenticated with check ((select private.is_staff()));
create policy quick_replies_staff_update on public.quick_replies for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

-- "Giá 'từ' cho mẫu trả lời" (Cài đặt)
alter table public.settings
  add column price_from_studio int not null default 8000000 check (price_from_studio between 0 and 1000000000),
  add column price_from_1br int not null default 10000000 check (price_from_1br between 0 and 1000000000),
  add column price_from_2br int not null default 12000000 check (price_from_2br between 0 and 1000000000);
