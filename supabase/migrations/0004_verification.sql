-- ---------------------------------------------------------------------------
-- 0004 — Hosted batch verification pages.
--
-- A label owner publishes a per-batch record (product, batch code, their
-- own field rows, their research-use notice, optionally a COA file) and
-- puts the tokened URL behind the label's QR code. The public page shows
-- the owner's data VERBATIM — Forge Labels hosts, it never tests,
-- certifies, or invents values (research-honesty invariant). Anonymous
-- readers resolve tokens exclusively through a security-definer RPC.
-- ---------------------------------------------------------------------------

create table public.batch_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  product_name text not null check (char_length(product_name) between 1 and 200),
  batch_code text not null check (char_length(batch_code) between 1 and 120),
  -- Ordered rows the owner typed: [{"label": "...", "value": "..."}, …]
  fields jsonb not null default '[]'::jsonb,
  -- The owner's research-use / intended-use statement, shown prominently.
  notice text,
  -- Certificate of analysis: object path in the public `coa` bucket plus
  -- the SHA-256 the client computed at upload (integrity display).
  coa_path text,
  coa_sha256 text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index batch_records_owner_idx on public.batch_records (owner_id, created_at desc);

alter table public.batch_records enable row level security;

create policy batch_records_select_own on public.batch_records
  for select using (auth.uid() = owner_id);
create policy batch_records_insert_own on public.batch_records
  for insert with check (auth.uid() = owner_id);
create policy batch_records_update_own on public.batch_records
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy batch_records_delete_own on public.batch_records
  for delete using (auth.uid() = owner_id);

-- Public resolution: token in, published record out. No table grants for
-- anon — the function is the only door, mirroring get_shared_project.
create or replace function public.get_batch_record(record_token text)
returns table (
  product_name text,
  batch_code text,
  fields jsonb,
  notice text,
  coa_path text,
  coa_sha256 text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.product_name, r.batch_code, r.fields, r.notice,
         r.coa_path, r.coa_sha256, r.created_at, r.updated_at
  from public.batch_records r
  where r.token = record_token and r.published;
$$;

revoke all on function public.get_batch_record(text) from public;
grant execute on function public.get_batch_record(text) to anon, authenticated;

-- COA files: public-read bucket (the verify page links straight to the
-- object), owner-namespaced writes: {uid}/{record-id}.pdf
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coa', 'coa', true, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy coa_owner_write on storage.objects
  for insert with check (
    bucket_id = 'coa' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy coa_owner_update on storage.objects
  for update using (
    bucket_id = 'coa' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy coa_owner_delete on storage.objects
  for delete using (
    bucket_id = 'coa' and (storage.foldername(name))[1] = auth.uid()::text
  );
