-- "Đặt làm bìa": one transactional call. The photo becomes the only cover of its listing / building and moves to
-- position 1 (sort 0); the others keep their order behind it. Only a live public photo can be the cover.
-- Who may: admin (any photo), sales (photos of their own listings) — the same rule as the other photo rpcs.
create function public.set_photo_cover(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.photos;
begin
  select * into p from public.photos where id = p_id and deleted_at is null and unit_id is null for update;
  if not found then raise exception 'photo not found' using errcode = '22023'; end if;
  if not private.can_edit_photo(p) then raise exception 'not allowed' using errcode = '42501'; end if;
  if p.visibility <> 'public' then raise exception 'internal photo' using errcode = '22023'; end if;

  -- unset first: one cover per owner is a unique index
  update public.photos set is_cover = false
   where is_cover and id <> p_id
     and ((p.listing_id is not null and listing_id = p.listing_id) or (p.building_id is not null and building_id = p.building_id));
  update public.photos q set is_cover = (q.id = p_id), sort = o.pos
    from (select id, (row_number() over (order by (id = p_id) desc, sort, created_at) - 1)::int as pos
            from public.photos
           where deleted_at is null
             and ((p.listing_id is not null and listing_id = p.listing_id) or (p.building_id is not null and building_id = p.building_id))) o
   where q.id = o.id and (q.sort is distinct from o.pos or q.is_cover is distinct from (q.id = p_id));
end $$;

revoke all on function public.set_photo_cover(uuid) from public, anon;
grant execute on function public.set_photo_cover(uuid) to authenticated, service_role;
