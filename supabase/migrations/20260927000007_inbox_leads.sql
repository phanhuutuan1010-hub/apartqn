-- ApartQN · 7 · consign assignment + lead notes (both SECURITY INVOKER: caller's RLS + guard triggers apply)

-- digits only → bigint ("10.000.000 ₫" → 10000000); '' → null
create function private.digits_to_bigint(t text) returns bigint
language sql immutable as $$ select nullif(regexp_replace(coalesce(t, ''), '[^0-9]', '', 'g'), '')::bigint $$;
-- "65,5 m2" → 65.5
create function private.to_numeric(t text) returns numeric
language sql immutable as $$
  select nullif(substring(replace(coalesce(t, ''), ',', '.') from '[0-9]+(?:\.[0-9]+)?'), '')::numeric
$$;
grant execute on function private.digits_to_bigint(text), private.to_numeric(text) to authenticated, service_role;

-- Admin: assign a consign request to a staff member → unit (with owner data) + draft listing prefilled
-- from the request. Returns the new listing id. Photo files are copied by the app afterwards.
create function public.assign_consign(p_consign uuid, p_assignee uuid, p_building uuid, p_floor int, p_unit_no text)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c public.consign_inbox; v_unit uuid; v_listing uuid; v_rent bigint; v_area numeric; v_beds int;
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  select * into c from public.consign_inbox where id = p_consign for update;
  if not found then raise exception 'consign request not found' using errcode = 'P0002'; end if;
  if c.status <> 'new' then raise exception 'consign request is already %', c.status using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_assignee and active) then
    raise exception 'assignee is not an active staff member' using errcode = '22023';
  end if;

  insert into public.units (building_id, floor, unit_no, owner_name, owner_phone, owner_notes, assigned_to)
  values (p_building, p_floor, trim(p_unit_no), c.owner_name, c.owner_phone,
          'Từ form ký gửi ngày ' || to_char(c.created_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'), p_assignee)
  returning id into v_unit;

  v_rent := private.digits_to_bigint(c.rent);
  v_area := private.to_numeric(c.area);
  v_beds := private.to_numeric(c.beds)::int;
  insert into public.listings (unit_id, rent, area, beds)
  values (v_unit,
          case when v_rent between 1000000 and 1000000000 then v_rent end,
          case when v_area > 0 and v_area < 1000 then v_area end,
          case when v_beds between 0 and 10 then v_beds end)
  returning id into v_listing;

  update public.consign_inbox
     set status = 'assigned', assigned_to = p_assignee, assigned_at = now(),
         building_id = coalesce(building_id, p_building), unit_id = v_unit, listing_id = v_listing
   where id = p_consign;
  return v_listing;
exception when unique_violation then
  raise exception 'Căn này đã có trong hệ thống (toà nhà + tầng + số căn trùng)' using errcode = '23505';
end $$;

-- Append a note to a lead (visible to whoever can see the lead). Returns the new notes array.
create function public.add_lead_note(p_lead uuid, p_text text)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v jsonb;
begin
  if not private.is_staff() then raise exception 'not allowed' using errcode = '42501'; end if;
  if coalesce(trim(p_text), '') = '' then raise exception 'empty note' using errcode = '22023'; end if;
  update public.leads
     set notes = notes || jsonb_build_array(jsonb_build_object('at', now(), 'by', auth.uid(), 'text', left(trim(p_text), 2000)))
   where id = p_lead
  returning notes into v;
  if v is null then raise exception 'not allowed' using errcode = '42501'; end if;
  return v;
end $$;

revoke all on function public.assign_consign(uuid, uuid, uuid, int, text), public.add_lead_note(uuid, text) from public, anon;
grant execute on function public.assign_consign(uuid, uuid, uuid, int, text), public.add_lead_note(uuid, text) to authenticated, service_role;
