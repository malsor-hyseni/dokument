-- =============================================================================
-- DOKUMENT — Skema e plotë e databazës
-- =============================================================================
-- Platformë për ruajtjen, organizimin dhe menaxhimin e dokumenteve personale.
--
-- SI TË EKZEKUTOHET:
--   Supabase Dashboard → SQL Editor → New query → ngjit gjithë këtë skedar → Run
--
-- Ky skript është IDEMPOTENT: mund të ekzekutohet disa herë pa gabime.
-- Përfshin: tabela, relacione, indekse, trigger-a, funksione, RLS dhe Storage.
--
-- SIGURIA: çdo tabelë ka Row Level Security të aktivizuar dhe politika që
-- izolojnë plotësisht të dhënat sipas `auth.uid()`. Asnjë përdorues nuk mund
-- të shohë, modifikojë apo fshijë të dhënat e një përdoruesi tjetër.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "unaccent" with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. KONFIGURIM I PËRGJITHSHËM
-- -----------------------------------------------------------------------------

-- Konfigurim teksti për kërkim pa shenja diakritike (ë, ç, etj.)
do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'dokument_search') then
    create text search configuration public.dokument_search (copy = pg_catalog.simple);
    alter text search configuration public.dokument_search
      alter mapping for hword, hword_part, word with extensions.unaccent, simple;
  end if;
end
$$;

-- =============================================================================
-- 2. TABELAT
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 profiles — profili i përdoruesit + cilësimet personale
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text,
  full_name            text check (full_name is null or char_length(full_name) <= 120),
  phone                text check (phone is null or char_length(phone) <= 40),
  avatar_url           text,
  theme                text not null default 'system' check (theme in ('light', 'dark', 'system')),
  expiry_warning_days  integer not null default 30 check (expiry_warning_days between 1 and 365),
  notifications_enabled boolean not null default true,
  storage_quota_bytes  bigint not null default 1073741824, -- 1 GB
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.profiles is 'Profili dhe cilësimet personale të çdo përdoruesi (1:1 me auth.users).';

-- -----------------------------------------------------------------------------
-- 2.2 categories — kategoritë e dokumenteve
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  color       text not null default 'slate'
              check (color in ('slate','blue','green','amber','red','violet','teal','rose','orange','indigo')),
  icon        text not null default 'folder' check (char_length(icon) <= 40),
  description text check (description is null or char_length(description) <= 300),
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists categories_user_name_key
  on public.categories (user_id, lower(btrim(name)));
create index if not exists categories_user_id_idx on public.categories (user_id);

comment on table public.categories is 'Kategoritë e dokumenteve, unike për çdo përdorues.';

-- -----------------------------------------------------------------------------
-- 2.3 folders — dosjet (hierarkike, me prind)
-- -----------------------------------------------------------------------------
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  parent_id  uuid references public.folders (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  color      text not null default 'slate'
             check (color in ('slate','blue','green','amber','red','violet','teal','rose','orange','indigo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists folders_user_parent_name_key
  on public.folders (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(name)));
create index if not exists folders_user_id_idx on public.folders (user_id);
create index if not exists folders_parent_id_idx on public.folders (parent_id);

comment on table public.folders is 'Dosjet hierarkike për organizimin e dokumenteve.';

-- -----------------------------------------------------------------------------
-- 2.4 tags — etiketat
-- -----------------------------------------------------------------------------
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  color      text not null default 'slate'
             check (color in ('slate','blue','green','amber','red','violet','teal','rose','orange','indigo')),
  created_at timestamptz not null default now()
);

create unique index if not exists tags_user_name_key on public.tags (user_id, lower(btrim(name)));
create index if not exists tags_user_id_idx on public.tags (user_id);

comment on table public.tags is 'Etiketat e lira për dokumentet.';

-- -----------------------------------------------------------------------------
-- 2.5 documents — dokumentet
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  category_id   uuid references public.categories (id) on delete set null,
  folder_id     uuid references public.folders (id) on delete set null,
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  description   text check (description is null or char_length(description) <= 2000),
  storage_path  text not null unique,
  file_name     text not null check (char_length(file_name) <= 255),
  file_size     bigint not null check (file_size >= 0 and file_size <= 52428800), -- 50 MB
  mime_type     text not null check (char_length(mime_type) <= 160),
  issue_date    date,
  expiry_date   date,
  is_favorite   boolean not null default false,
  is_archived   boolean not null default false,
  search_vector tsvector,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint documents_dates_valid check (
    issue_date is null or expiry_date is null or expiry_date >= issue_date
  )
);

create index if not exists documents_user_id_idx        on public.documents (user_id);
create index if not exists documents_user_created_idx   on public.documents (user_id, created_at desc);
create index if not exists documents_category_id_idx    on public.documents (category_id);
create index if not exists documents_folder_id_idx      on public.documents (folder_id);
create index if not exists documents_expiry_idx         on public.documents (user_id, expiry_date)
  where expiry_date is not null and is_archived = false;
create index if not exists documents_favorite_idx       on public.documents (user_id)
  where is_favorite = true;
create index if not exists documents_search_idx         on public.documents using gin (search_vector);
create index if not exists documents_title_lower_idx    on public.documents (user_id, lower(title));

comment on table public.documents is 'Dokumentet e ruajtura; skedari fizik qëndron në Storage (bucket privat "documents").';

-- -----------------------------------------------------------------------------
-- 2.6 document_tags — lidhja shumë-me-shumë dokument ↔ etiketë
-- -----------------------------------------------------------------------------
create table if not exists public.document_tags (
  document_id uuid not null references public.documents (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (document_id, tag_id)
);

create index if not exists document_tags_tag_id_idx  on public.document_tags (tag_id);
create index if not exists document_tags_user_id_idx on public.document_tags (user_id);

comment on table public.document_tags is 'Relacioni shumë-me-shumë mes dokumenteve dhe etiketave.';

-- -----------------------------------------------------------------------------
-- 2.7 notifications — njoftimet për skadim
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  type        text not null check (type in ('expiring', 'expired')),
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Indeks jo i pjesshëm: lejon përdorimin e `on conflict (document_id, type)`.
-- Rreshtat me document_id = null nuk ndikohen (NULL-at trajtohen si të dallueshme).
create unique index if not exists notifications_document_type_key
  on public.notifications (document_id, type);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where is_read = false;

comment on table public.notifications is 'Njoftime në aplikacion për dokumentet që skadojnë ose kanë skaduar.';

-- -----------------------------------------------------------------------------
-- 2.8 activity_log — historiku i veprimeve
-- -----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  action      text not null check (action in ('created', 'updated', 'deleted', 'downloaded', 'viewed')),
  entity      text not null check (entity in ('document', 'folder', 'category', 'tag', 'profile')),
  entity_id   uuid,
  label       text,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_user_idx on public.activity_log (user_id, created_at desc);

comment on table public.activity_log is 'Historik i thjeshtë i veprimeve të përdoruesit.';

-- =============================================================================
-- 3. FUNKSIONE DHE TRIGGER-A
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 updated_at automatik
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.categories;
create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.folders;
create trigger set_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.documents;
create trigger set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3.2 search_vector për kërkim të shpejtë full-text
-- -----------------------------------------------------------------------------
create or replace function public.documents_search_vector()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('public.dokument_search', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('public.dokument_search', coalesce(new.file_name, '')), 'B') ||
    setweight(to_tsvector('public.dokument_search', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

drop trigger if exists documents_search_vector_trigger on public.documents;
create trigger documents_search_vector_trigger
  before insert or update of title, description, file_name on public.documents
  for each row execute function public.documents_search_vector();

-- -----------------------------------------------------------------------------
-- 3.3 Siguri: user_id i document_tags duhet të përputhet me pronarin
-- -----------------------------------------------------------------------------
create or replace function public.document_tags_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc_owner uuid;
  tag_owner uuid;
begin
  select user_id into doc_owner from public.documents where id = new.document_id;
  select user_id into tag_owner from public.tags where id = new.tag_id;

  if doc_owner is null or tag_owner is null then
    raise exception 'Dokumenti ose etiketa nuk ekziston.';
  end if;

  if doc_owner <> tag_owner then
    raise exception 'Dokumenti dhe etiketa duhet t''i përkasin të njëjtit përdorues.';
  end if;

  new.user_id := doc_owner;
  return new;
end;
$$;

drop trigger if exists document_tags_guard_trigger on public.document_tags;
create trigger document_tags_guard_trigger
  before insert or update on public.document_tags
  for each row execute function public.document_tags_guard();

-- -----------------------------------------------------------------------------
-- 3.4 Siguri: dosja prind nuk mund të jetë vetvetja dhe duhet të jetë e njëjti pronar
-- -----------------------------------------------------------------------------
create or replace function public.folders_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent_owner uuid;
  cursor_id uuid;
  depth integer := 0;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Një dosje nuk mund të jetë prind i vetvetes.';
    end if;

    select user_id into parent_owner from public.folders where id = new.parent_id;
    if parent_owner is null then
      raise exception 'Dosja prind nuk ekziston.';
    end if;
    if parent_owner <> new.user_id then
      raise exception 'Dosja prind i përket një përdoruesi tjetër.';
    end if;

    -- parandalon ciklet (A → B → A)
    cursor_id := new.parent_id;
    while cursor_id is not null and depth < 24 loop
      if cursor_id = new.id then
        raise exception 'Hierarkia e dosjeve nuk mund të jetë ciklike.';
      end if;
      select parent_id into cursor_id from public.folders where id = cursor_id;
      depth := depth + 1;
    end loop;

    if depth >= 24 then
      raise exception 'Hierarkia e dosjeve është shumë e thellë (maks. 24 nivele).';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists folders_guard_trigger on public.folders;
create trigger folders_guard_trigger
  before insert or update of parent_id on public.folders
  for each row execute function public.folders_guard();

-- -----------------------------------------------------------------------------
-- 3.5 Krijimi automatik i profilit + kategorive bazë pas regjistrimit
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, color, icon, is_system)
  values
    (new.id, 'Dokumente personale', 'blue',   'user',         true),
    (new.id, 'Financa',             'green',  'wallet',       true),
    (new.id, 'Shëndetësi',          'rose',   'heart-pulse',  true),
    (new.id, 'Arsim',               'violet', 'graduation-cap', true),
    (new.id, 'Punë',                'amber',  'briefcase',    true),
    (new.id, 'Automjet',            'teal',   'car',          true),
    (new.id, 'Banesë',              'orange', 'house',        true),
    (new.id, 'Të tjera',            'slate',  'folder',       true)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3.6 Sinkronizimi i email-it kur përdoruesi e ndryshon
-- -----------------------------------------------------------------------------
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- -----------------------------------------------------------------------------
-- 3.7 Log automatik i veprimeve mbi dokumentet
-- -----------------------------------------------------------------------------
create or replace function public.log_document_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (user_id, action, entity, entity_id, label)
    values (new.user_id, 'created', 'document', new.id, new.title);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.title is distinct from old.title
       or new.description is distinct from old.description
       or new.category_id is distinct from old.category_id
       or new.folder_id is distinct from old.folder_id
       or new.expiry_date is distinct from old.expiry_date
       or new.storage_path is distinct from old.storage_path then
      insert into public.activity_log (user_id, action, entity, entity_id, label)
      values (new.user_id, 'updated', 'document', new.id, new.title);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.activity_log (user_id, action, entity, entity_id, label)
    values (old.user_id, 'deleted', 'document', old.id, old.title);
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists log_document_activity_trigger on public.documents;
create trigger log_document_activity_trigger
  after insert or update or delete on public.documents
  for each row execute function public.log_document_activity();

-- -----------------------------------------------------------------------------
-- 3.8 Pastrimi i njoftimeve kur ndryshon data e skadimit
-- -----------------------------------------------------------------------------
create or replace function public.clear_stale_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expiry_date is distinct from old.expiry_date or new.is_archived is distinct from old.is_archived then
    delete from public.notifications where document_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_stale_notifications_trigger on public.documents;
create trigger clear_stale_notifications_trigger
  after update of expiry_date, is_archived on public.documents
  for each row execute function public.clear_stale_notifications();

-- =============================================================================
-- 4. FUNKSIONE RPC (të thirrura nga frontend-i)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 get_dashboard_stats — statistikat për dashboard
-- -----------------------------------------------------------------------------
create or replace function public.get_dashboard_stats()
returns jsonb
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  warn_days integer;
  result jsonb;
begin
  if uid is null then
    raise exception 'Kërkohet autentikim.' using errcode = '42501';
  end if;

  select coalesce(expiry_warning_days, 30) into warn_days
  from public.profiles where id = uid;
  warn_days := coalesce(warn_days, 30);

  select jsonb_build_object(
    'total_documents',  count(*) filter (where d.is_archived = false),
    'archived_documents', count(*) filter (where d.is_archived = true),
    'favorite_documents', count(*) filter (where d.is_favorite = true and d.is_archived = false),
    'storage_used',     coalesce(sum(d.file_size) , 0),
    'expiring_soon',    count(*) filter (
                          where d.is_archived = false
                            and d.expiry_date is not null
                            and d.expiry_date >= current_date
                            and d.expiry_date <= current_date + warn_days
                        ),
    'expired',          count(*) filter (
                          where d.is_archived = false
                            and d.expiry_date is not null
                            and d.expiry_date < current_date
                        ),
    'added_this_month', count(*) filter (where d.created_at >= date_trunc('month', now()))
  )
  into result
  from public.documents d
  where d.user_id = uid;

  result := coalesce(result, '{}'::jsonb) || jsonb_build_object(
    'total_categories', (select count(*) from public.categories where user_id = uid),
    'total_folders',    (select count(*) from public.folders where user_id = uid),
    'total_tags',       (select count(*) from public.tags where user_id = uid),
    'unread_notifications', (select count(*) from public.notifications where user_id = uid and is_read = false),
    'storage_quota',    (select coalesce(storage_quota_bytes, 1073741824) from public.profiles where id = uid),
    'warning_days',     warn_days,
    'by_category',      coalesce((
      select jsonb_agg(entry order by entry ->> 'name')
      from (
        select jsonb_build_object(
                 'id', c.id,
                 'name', c.name,
                 'color', c.color,
                 'icon', c.icon,
                 'count', count(d.id),
                 'size', coalesce(sum(d.file_size), 0)
               ) as entry
        from public.categories c
        left join public.documents d
          on d.category_id = c.id and d.user_id = uid and d.is_archived = false
        where c.user_id = uid
        group by c.id, c.name, c.color, c.icon
      ) s
    ), '[]'::jsonb),
    'by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', m.month, 'count', m.count) order by m.month)
      from (
        select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*) as count
        from public.documents
        where user_id = uid and created_at >= date_trunc('month', now()) - interval '5 months'
        group by 1
      ) m
    ), '[]'::jsonb)
  );

  return result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4.2 sync_expiry_notifications — gjeneron njoftimet për dokumentet që skadojnë
-- -----------------------------------------------------------------------------
create or replace function public.sync_expiry_notifications()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  warn_days integer;
  inserted_expired integer := 0;
  inserted_expiring integer := 0;
begin
  if uid is null then
    raise exception 'Kërkohet autentikim.' using errcode = '42501';
  end if;

  select coalesce(expiry_warning_days, 30) into warn_days from public.profiles where id = uid;
  warn_days := coalesce(warn_days, 30);

  -- Hiq njoftimet që nuk vlejnë më
  delete from public.notifications n
  where n.user_id = uid
    and n.document_id is not null
    and not exists (
      select 1 from public.documents d
      where d.id = n.document_id
        and d.is_archived = false
        and d.expiry_date is not null
        and (
          (n.type = 'expired'  and d.expiry_date < current_date) or
          (n.type = 'expiring' and d.expiry_date >= current_date and d.expiry_date <= current_date + warn_days)
        )
    );

  -- Njoftime për dokumentet e skaduara
  insert into public.notifications (user_id, document_id, type, title, body)
  select
    d.user_id,
    d.id,
    'expired',
    d.title,
    'Ky dokument ka skaduar më ' || to_char(d.expiry_date, 'DD.MM.YYYY') || '.'
  from public.documents d
  where d.user_id = uid
    and d.is_archived = false
    and d.expiry_date is not null
    and d.expiry_date < current_date
  on conflict (document_id, type) do nothing;

  get diagnostics inserted_expired = row_count;

  -- Njoftime për dokumentet që po skadojnë
  insert into public.notifications (user_id, document_id, type, title, body)
  select
    d.user_id,
    d.id,
    'expiring',
    d.title,
    'Skadon më ' || to_char(d.expiry_date, 'DD.MM.YYYY') ||
    ' (pas ' || (d.expiry_date - current_date) || ' ditësh).'
  from public.documents d
  where d.user_id = uid
    and d.is_archived = false
    and d.expiry_date is not null
    and d.expiry_date >= current_date
    and d.expiry_date <= current_date + warn_days
  on conflict (document_id, type) do nothing;

  get diagnostics inserted_expiring = row_count;
  return inserted_expired + inserted_expiring;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4.3 search_documents — kërkim full-text me filtra
-- -----------------------------------------------------------------------------
create or replace function public.search_documents(
  q           text default null,
  p_category  uuid default null,
  p_folder    uuid default null,
  p_tag       uuid default null,
  p_status    text default 'all',     -- all | valid | expiring | expired | no_expiry | favorite | archived
  p_sort      text default 'created_desc',
  p_limit     integer default 20,
  p_offset    integer default 0
)
returns table (
  id uuid,
  title text,
  description text,
  file_name text,
  file_size bigint,
  mime_type text,
  storage_path text,
  issue_date date,
  expiry_date date,
  is_favorite boolean,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  category_id uuid,
  category_name text,
  category_color text,
  folder_id uuid,
  folder_name text,
  tags jsonb,
  total_count bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  with warn as (
    select coalesce(
      (select expiry_warning_days from public.profiles where id = auth.uid()),
      30
    ) as days
  ),
  filtered as (
    select d.*
    from public.documents d
    left join public.document_tags dt on dt.document_id = d.id
    where d.user_id = auth.uid()
      and (p_category is null or d.category_id = p_category)
      and (p_folder is null or d.folder_id = p_folder)
      and (p_tag is null or dt.tag_id = p_tag)
      and (
        q is null or btrim(q) = ''
        or d.search_vector @@ plainto_tsquery('public.dokument_search', q)
        or d.title ilike '%' || q || '%'
        or d.file_name ilike '%' || q || '%'
      )
      and (
        case coalesce(p_status, 'all')
          when 'archived'  then d.is_archived = true
          when 'favorite'  then d.is_favorite = true and d.is_archived = false
          when 'expired'   then d.is_archived = false and d.expiry_date is not null and d.expiry_date < current_date
          when 'expiring'  then d.is_archived = false and d.expiry_date is not null
                                and d.expiry_date >= current_date
                                and d.expiry_date <= current_date + (select days from warn)
          when 'valid'     then d.is_archived = false and (d.expiry_date is null or d.expiry_date > current_date + (select days from warn))
          when 'no_expiry' then d.is_archived = false and d.expiry_date is null
          else d.is_archived = false
        end
      )
    group by d.id
  ),
  counted as (select count(*) as total from filtered)
  select
    f.id,
    f.title,
    f.description,
    f.file_name,
    f.file_size,
    f.mime_type,
    f.storage_path,
    f.issue_date,
    f.expiry_date,
    f.is_favorite,
    f.is_archived,
    f.created_at,
    f.updated_at,
    f.category_id,
    c.name  as category_name,
    c.color as category_color,
    f.folder_id,
    fo.name as folder_name,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) order by t.name)
      from public.document_tags dt2
      join public.tags t on t.id = dt2.tag_id
      where dt2.document_id = f.id
    ), '[]'::jsonb) as tags,
    (select total from counted) as total_count
  from filtered f
  left join public.categories c on c.id = f.category_id
  left join public.folders fo   on fo.id = f.folder_id
  order by
    case when p_sort = 'created_asc'  then f.created_at end asc,
    case when p_sort = 'title_asc'    then lower(f.title) end asc,
    case when p_sort = 'title_desc'   then lower(f.title) end desc,
    case when p_sort = 'size_asc'     then f.file_size end asc,
    case when p_sort = 'size_desc'    then f.file_size end desc,
    case when p_sort = 'expiry_asc'   then f.expiry_date end asc nulls last,
    case when p_sort = 'expiry_desc'  then f.expiry_date end desc nulls last,
    case when p_sort not in ('created_asc','title_asc','title_desc','size_asc','size_desc','expiry_asc','expiry_desc')
         then f.created_at end desc
  limit greatest(1, least(coalesce(p_limit, 20), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

-- -----------------------------------------------------------------------------
-- 4.4 get_folder_tree — pema e dosjeve me numrin e dokumenteve
-- -----------------------------------------------------------------------------
create or replace function public.get_folder_tree()
returns table (
  id uuid,
  parent_id uuid,
  name text,
  color text,
  depth integer,
  path text,
  document_count bigint,
  created_at timestamptz
)
language sql
security invoker
stable
set search_path = ''
as $$
  with recursive tree as (
    select f.id, f.parent_id, f.name, f.color, 0 as depth,
           lower(f.name) as path, f.created_at
    from public.folders f
    where f.user_id = auth.uid() and f.parent_id is null
    union all
    select f.id, f.parent_id, f.name, f.color, t.depth + 1,
           t.path || ' / ' || lower(f.name), f.created_at
    from public.folders f
    join tree t on f.parent_id = t.id
    where f.user_id = auth.uid() and t.depth < 24
  )
  select
    t.id, t.parent_id, t.name, t.color, t.depth, t.path,
    (select count(*) from public.documents d
      where d.folder_id = t.id and d.user_id = auth.uid() and d.is_archived = false) as document_count,
    t.created_at
  from tree t
  order by t.path;
$$;

-- -----------------------------------------------------------------------------
-- 4.5 delete_all_my_data — fshin të gjitha të dhënat e përdoruesit
-- -----------------------------------------------------------------------------
create or replace function public.delete_all_my_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then
    raise exception 'Kërkohet autentikim.' using errcode = '42501';
  end if;

  delete from public.documents where user_id = uid;
  get diagnostics removed = row_count;

  delete from public.notifications where user_id = uid;
  delete from public.document_tags where user_id = uid;
  delete from public.tags where user_id = uid;
  delete from public.folders where user_id = uid;
  delete from public.categories where user_id = uid;
  delete from public.activity_log where user_id = uid;

  return jsonb_build_object('deleted_documents', removed);
end;
$$;

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================
-- Çdo tabelë: RLS i aktivizuar + politika të ndara për SELECT/INSERT/UPDATE/DELETE.
-- Izolimi bëhet gjithmonë me `(select auth.uid()) = user_id`.
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.categories    enable row level security;
alter table public.folders       enable row level security;
alter table public.tags          enable row level security;
alter table public.documents     enable row level security;
alter table public.document_tags enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log  enable row level security;

-- Shënim: nuk përdoret `force row level security`, sepse trigger-at e sistemit
-- (p.sh. krijimi i profilit pas regjistrimit) ekzekutohen si pronar i tabelës
-- përpara se të ekzistojë një sesion i autentikuar. Qasja e jashtme bëhet
-- gjithmonë përmes rolit `authenticated`, i cili i nënshtrohet politikave më poshtë.

-- ---------- profiles ----------
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- ---------- categories ----------
drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- folders ----------
drop policy if exists "folders_select_own" on public.folders;
create policy "folders_select_own" on public.folders
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own" on public.folders
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own" on public.folders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_delete_own" on public.folders
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- tags ----------
drop policy if exists "tags_select_own" on public.tags;
create policy "tags_select_own" on public.tags
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "tags_insert_own" on public.tags;
create policy "tags_insert_own" on public.tags
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "tags_update_own" on public.tags;
create policy "tags_update_own" on public.tags
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_delete_own" on public.tags
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- documents ----------
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    -- skedari duhet të ndodhet brenda dosjes së vetë përdoruesit në Storage
    and storage_path like ((select auth.uid())::text || '/%')
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
    ))
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  );

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and storage_path like ((select auth.uid())::text || '/%')
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
    ))
    and (folder_id is null or exists (
      select 1 from public.folders f where f.id = folder_id and f.user_id = (select auth.uid())
    ))
  );

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- document_tags ----------
drop policy if exists "document_tags_select_own" on public.document_tags;
create policy "document_tags_select_own" on public.document_tags
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "document_tags_insert_own" on public.document_tags;
create policy "document_tags_insert_own" on public.document_tags
  for insert to authenticated
  with check (
    exists (select 1 from public.documents d where d.id = document_id and d.user_id = (select auth.uid()))
    and exists (select 1 from public.tags t where t.id = tag_id and t.user_id = (select auth.uid()))
  );

drop policy if exists "document_tags_delete_own" on public.document_tags;
create policy "document_tags_delete_own" on public.document_tags
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- notifications ----------
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- activity_log ----------
drop policy if exists "activity_select_own" on public.activity_log;
create policy "activity_select_own" on public.activity_log
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "activity_insert_own" on public.activity_log;
create policy "activity_insert_own" on public.activity_log
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "activity_delete_own" on public.activity_log;
create policy "activity_delete_own" on public.activity_log
  for delete to authenticated using ((select auth.uid()) = user_id);

-- =============================================================================
-- 6. TË DREJTAT (GRANTS)
-- =============================================================================
-- `anon` nuk merr asnjë të drejtë mbi të dhënat: vetëm përdoruesit e kyçur.

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

-- Hiq të drejtën e nënkuptuar `PUBLIC` mbi funksionet RPC, që t'i ekzekutojnë
-- vetëm përdoruesit e autentikuar.
revoke all on function public.get_dashboard_stats() from public;
revoke all on function public.sync_expiry_notifications() from public;
revoke all on function public.search_documents(text, uuid, uuid, uuid, text, text, integer, integer) from public;
revoke all on function public.get_folder_tree() from public;
revoke all on function public.delete_all_my_data() from public;

grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles, public.categories, public.folders, public.tags,
  public.documents, public.document_tags, public.notifications
  to authenticated;

grant select, insert, delete on public.activity_log to authenticated;

grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.sync_expiry_notifications() to authenticated;
grant execute on function public.search_documents(text, uuid, uuid, uuid, text, text, integer, integer) to authenticated;
grant execute on function public.get_folder_tree() to authenticated;
grant execute on function public.delete_all_my_data() to authenticated;

-- =============================================================================
-- 7. STORAGE — bucket privat + politika
-- =============================================================================
-- Struktura e rrugës së skedarit:  {user_id}/{document_id}/{emri_i_skedarit}
-- Politikat lejojnë vetëm veprime brenda dosjes që ka si emër id-në e përdoruesit.
-- =============================================================================

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

-- Bucket për fotot e profilit (publik vetëm për lexim)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/png','image/jpeg','image/webp','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------- politikat e bucket-it "documents" ----------
drop policy if exists "documents_storage_select_own" on storage.objects;
create policy "documents_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documents_storage_insert_own" on storage.objects;
create policy "documents_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and array_length(storage.foldername(name), 1) >= 2
  );

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

drop policy if exists "documents_storage_delete_own" on storage.objects;
create policy "documents_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------- politikat e bucket-it "avatars" ----------
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
-- 8. REALTIME (opsionale — për njoftime në kohë reale)
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.documents;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;

-- =============================================================================
-- 9. PROFILET PËR PËRDORUESIT EKZISTUES (nëse ka)
-- =============================================================================
insert into public.profiles (id, email)
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- =============================================================================
-- FUND — Skema u instalua me sukses.
-- =============================================================================
