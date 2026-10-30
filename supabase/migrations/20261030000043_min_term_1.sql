-- ApartQN · 43 · minimum rental term is now 1 month. Additive: listings.min_term default 1 (existing rows → 1);
-- unit_types.min_term added (default 1), used by generated descriptions and posts.
alter table public.listings alter column min_term set default 1;
alter table public.listings disable trigger user;
update public.listings set min_term = 1 where min_term is distinct from 1;
alter table public.listings enable trigger user;

alter table public.unit_types add column if not exists min_term int not null default 1 check (min_term between 1 and 120);
