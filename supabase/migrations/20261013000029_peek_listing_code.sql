-- ApartQN · 29 · "Mã dự kiến" on drafts
-- peek_next_listing_code: the code the building would hand out next ({PREFIX}-{NNN} from code_seq + 1). Read-only: no
-- increment, no reservation — the real code is still assigned atomically on first publish (private.next_listing_code).
-- code_seq only ever grows, so numbers of hidden / deleted listings are never offered again. NULL = no prefix yet.
create function public.peek_next_listing_code(p_building uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_prefix text; v_n int;
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  select b.code_prefix, b.code_seq + 1 into v_prefix, v_n from public.buildings b where b.id = p_building and b.deleted_at is null;
  if v_prefix is null then return null; end if;
  return v_prefix || '-' || case when v_n < 1000 then lpad(v_n::text, 3, '0') else v_n::text end;
end $$;
revoke all on function public.peek_next_listing_code(uuid) from public, anon;
grant execute on function public.peek_next_listing_code(uuid) to authenticated, service_role;
