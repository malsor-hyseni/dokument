-- =============================================================================
-- DOKUMENT — Konfigurimi i Storage dhe politikat e qasjes
-- =============================================================================
-- SHËNIM: ky skedar është i përfshirë tashmë në `schema.sql` (seksioni 7).
-- Ekziston veçmas në rast se dëshironi ta riaplikoni vetëm konfigurimin e
-- Storage pa prekur tabelat. Mund të ekzekutohet disa herë pa probleme.
--
-- Supabase Dashboard → SQL Editor → New query → ngjit → Run
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BUCKET-AT
-- -----------------------------------------------------------------------------
-- `documents` — PRIVAT. Skedarët arrihen vetëm me URL të nënshkruar (signed URL)
--               që gjenerohet për përdoruesin e kyçur, me afat të kufizuar.
-- `avatars`   — publik vetëm për lexim (fotot e profilit).
--
-- Struktura e rrugës:  {user_id}/{document_id}/{emri_i_skedarit}
-- Elementi i parë i rrugës ËSHTË id-ja e përdoruesit — mbi të ndërtohen politikat.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'image/png','image/jpeg','image/webp','image/gif','image/heic','image/heif','image/svg+xml',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/plain','text/csv','text/markdown',
    'application/zip','application/x-zip-compressed','application/rtf'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152, -- 2 MB
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. POLITIKAT E BUCKET-IT `documents`
-- -----------------------------------------------------------------------------
-- Lexim: vetëm skedarët brenda dosjes që ka si emër id-në e përdoruesit.
drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Ngarkim: vetëm brenda dosjes së vet, dhe gjithmonë në nën-dosje
-- ({user_id}/{document_id}/...), kurrë direkt në rrënjë.
drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) >= 2
  );

-- Përditësim (zëvendësim skedari): vetëm skedarët e vet.
drop policy if exists "documents_storage_update_own" on storage.objects;
create policy "documents_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Fshirje: vetëm skedarët e vet.
drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- -----------------------------------------------------------------------------
-- 3. POLITIKAT E BUCKET-IT `avatars`
-- -----------------------------------------------------------------------------
drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- =============================================================================
-- VERIFIKIM
-- =============================================================================
-- select id, public, file_size_limit from storage.buckets;
-- select policyname, cmd from pg_policies where schemaname = 'storage';
-- =============================================================================
