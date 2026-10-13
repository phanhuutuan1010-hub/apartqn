-- Photos whose source is too small to look sharp: the admin shows "Ảnh chất lượng thấp – tải lại ảnh gốc".
-- Nothing is deleted or re-rendered here.
alter table public.photos add column if not exists needs_reupload boolean not null default false;
comment on column public.photos.needs_reupload is
  'Source too small for a sharp public photo: narrower than 1200 px, or made by the old in-browser compression (<= 1600 px, q82) before the original-upload pipeline.';

-- Public photos created before the original-upload pipeline went live (2026-10-13 15:27 +07) were downscaled and
-- compressed in the browser; newer ones are flagged only when the source itself is narrower than 1200 px.
update public.photos
   set needs_reupload = true
 where visibility = 'public'
   and not needs_reupload
   and (created_at < timestamptz '2026-10-13 08:27:00+00' or coalesce(width, 0) < 1200);
