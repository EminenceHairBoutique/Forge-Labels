-- Forge Labels — initial schema
--
-- Conventions:
-- * Every user-content table carries owner_id (denormalized onto children)
--   so RLS stays index-friendly — no EXISTS joins on hot paths.
-- * Roles live in user_roles, which ONLY the service role can write:
--   a self-updatable profiles.role would be a self-promotion hole.
-- * Documents are stored as validated JSONB (the app re-validates with Zod
--   on load; schemaVersion migrations run client-side).
-- * subscriptions/stripe_* have NO authenticated write policies: the Stripe
--   webhook (service role) is the only writer.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile for each new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Platform roles: written exclusively by the service role.
create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'support')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Organizations (teams) — schema + RLS ready; UI ships in a later phase
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

create or replace function public.org_role_rank(role text)
returns int language sql immutable as $$
  select case role
    when 'owner' then 4
    when 'admin' then 3
    when 'editor' then 2
    when 'viewer' then 1
    else 0
  end;
$$;

create or replace function public.is_org_member(target_org uuid, min_role text default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and public.org_role_rank(m.role) >= public.org_role_rank(min_role)
  );
$$;

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Billing (plans are public content; subscriptions are webhook-managed)
-- ---------------------------------------------------------------------------

create table public.plans (
  id text primary key,
  name text not null,
  blurb text not null default '',
  price_monthly_cents integer,          -- null = custom/contact
  price_yearly_cents integer,
  stripe_price_monthly text,            -- Stripe Price ids, set during setup
  stripe_price_yearly text,
  highlights jsonb not null default '[]',
  entitlements jsonb not null default '{}',
  highlighted boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create table public.stripe_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id text primary key,                  -- Stripe subscription id
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Webhook idempotency ledger.
create table public.stripe_events (
  id text primary key,                  -- Stripe event id
  type text not null,
  processed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Content
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  name text not null,
  tags text[] not null default '{}',
  doc jsonb not null,
  thumbnail text,                        -- small data URL
  label_width_mm numeric not null default 0,
  label_height_mm numeric not null default 0,
  vial_preset_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, updated_at desc);
create index projects_org_idx on public.projects (org_id) where org_id is not null;

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  reason text not null default 'Manual save',
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create index project_versions_project_idx
  on public.project_versions (project_id, created_at desc);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  name text not null,
  mime_type text not null,
  byte_size integer not null,
  width integer,
  height integer,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index assets_owner_idx on public.assets (owner_id, created_at desc);

create table public.fonts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  family_name text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  name text not null,
  colors jsonb not null default '[]',
  font_family_ids text[] not null default '{}',
  logo_asset_ids uuid[] not null default '{}',
  contact jsonb not null default '{}',
  standard_warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_kits_owner_idx on public.brand_kits (owner_id, updated_at desc);

create trigger brand_kits_updated_at before update on public.brand_kits
  for each row execute function public.set_updated_at();

-- System rows have owner_id null (admin-managed); user rows are private.
create table public.vial_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  preset jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  brand text not null,
  description text not null default '',
  categories text[] not null default '{}',
  premium boolean not null default false,
  preset_id text not null,
  doc jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

create table public.template_categories (
  id text primary key,
  name text not null,
  sort integer not null default 0
);

create table public.print_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table public.sheet_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table public.export_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  project_name text not null default '',
  kind text not null,
  file_name text not null,
  byte_size integer not null default 0,
  dpi integer,
  created_at timestamptz not null default now()
);

create index export_jobs_owner_idx on public.export_jobs (owner_id, created_at desc);

create table public.shared_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  mode text not null default 'view' check (mode in ('view', 'edit')),
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  action text not null,
  subject text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_logs_user_idx on public.activity_logs (user_id, created_at desc);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger admin_settings_updated_at before update on public.admin_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.plans enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
alter table public.projects enable row level security;
alter table public.project_versions enable row level security;
alter table public.assets enable row level security;
alter table public.fonts enable row level security;
alter table public.brand_kits enable row level security;
alter table public.vial_presets enable row level security;
alter table public.templates enable row level security;
alter table public.template_categories enable row level security;
alter table public.print_presets enable row level security;
alter table public.sheet_presets enable row level security;
alter table public.export_jobs enable row level security;
alter table public.shared_links enable row level security;
alter table public.activity_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_settings enable row level security;

-- profiles: users see/update themselves; admins can read all.
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- user_roles: readable by the subject and admins; NO write policies
-- (service role only).
create policy user_roles_select on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());

-- organizations
create policy organizations_select on public.organizations
  for select using (
    owner_id = auth.uid() or public.is_org_member(id) or public.is_admin()
  );
create policy organizations_insert on public.organizations
  for insert with check (owner_id = auth.uid());
create policy organizations_update on public.organizations
  for update using (owner_id = auth.uid() or public.is_org_member(id, 'admin'));
create policy organizations_delete on public.organizations
  for delete using (owner_id = auth.uid());

-- organization_members
create policy organization_members_select on public.organization_members
  for select using (
    user_id = auth.uid() or public.is_org_member(org_id) or public.is_admin()
  );
create policy organization_members_write on public.organization_members
  for all using (public.is_org_member(org_id, 'admin'))
  with check (public.is_org_member(org_id, 'admin'));

-- team_invitations: org admins manage; invitees redeem via service role.
create policy team_invitations_select on public.team_invitations
  for select using (public.is_org_member(org_id, 'admin'));
create policy team_invitations_write on public.team_invitations
  for all using (public.is_org_member(org_id, 'admin'))
  with check (public.is_org_member(org_id, 'admin'));

-- plans: anonymous read of active plans (pricing page); admin write.
create policy plans_select on public.plans
  for select using (active or public.is_admin());
create policy plans_write on public.plans
  for all using (public.is_admin()) with check (public.is_admin());

-- stripe_customers: subject can read the mapping; service role writes.
create policy stripe_customers_select on public.stripe_customers
  for select using (user_id = auth.uid() or public.is_admin());

-- subscriptions: subject + admins read; service role writes.
create policy subscriptions_select on public.subscriptions
  for select using (user_id = auth.uid() or public.is_admin());

-- stripe_events: admins may inspect; service role writes.
create policy stripe_events_select on public.stripe_events
  for select using (public.is_admin());

-- projects
create policy projects_select on public.projects
  for select using (
    owner_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id))
  );
create policy projects_insert on public.projects
  for insert with check (owner_id = auth.uid());
create policy projects_update on public.projects
  for update using (
    owner_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id, 'editor'))
  );
create policy projects_delete on public.projects
  for delete using (
    owner_id = auth.uid()
    or (org_id is not null and public.is_org_member(org_id, 'admin'))
  );

-- project_versions: follow the owner (denormalized owner_id).
create policy project_versions_select on public.project_versions
  for select using (owner_id = auth.uid());
create policy project_versions_insert on public.project_versions
  for insert with check (owner_id = auth.uid());
create policy project_versions_delete on public.project_versions
  for delete using (owner_id = auth.uid());

-- assets / fonts / brand kits / presets / export jobs: owner-scoped.
create policy assets_all on public.assets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy fonts_all on public.fonts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy brand_kits_all on public.brand_kits
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy print_presets_all on public.print_presets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy sheet_presets_all on public.sheet_presets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy export_jobs_all on public.export_jobs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- vial_presets: system rows (owner null) are public; user rows are private.
create policy vial_presets_select on public.vial_presets
  for select using (owner_id is null or owner_id = auth.uid());
create policy vial_presets_user_write on public.vial_presets
  for insert with check (owner_id = auth.uid());
create policy vial_presets_user_update on public.vial_presets
  for update using (owner_id = auth.uid());
create policy vial_presets_user_delete on public.vial_presets
  for delete using (owner_id = auth.uid());
create policy vial_presets_admin on public.vial_presets
  for all using (public.is_admin()) with check (public.is_admin());

-- templates: published are public (incl. anonymous); admins manage all.
create policy templates_select on public.templates
  for select using (status = 'published' or public.is_admin());
create policy templates_write on public.templates
  for all using (public.is_admin()) with check (public.is_admin());

-- template_categories: public read, admin write.
create policy template_categories_select on public.template_categories
  for select using (true);
create policy template_categories_write on public.template_categories
  for all using (public.is_admin()) with check (public.is_admin());

-- shared_links: owners manage their links. Anonymous resolution deliberately
-- has NO select policy — it goes through the security-definer RPC below so
-- tokens can be validated, rate-limited, and audited.
create policy shared_links_all on public.shared_links
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- activity_logs: users read their own; inserts of their own actions.
create policy activity_logs_select on public.activity_logs
  for select using (user_id = auth.uid() or public.is_admin());
create policy activity_logs_insert on public.activity_logs
  for insert with check (user_id = auth.uid());

-- announcements: active ones are public; admin write.
create policy announcements_select on public.announcements
  for select using (active or public.is_admin());
create policy announcements_write on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

-- admin_settings: admin only.
create policy admin_settings_all on public.admin_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Share-link resolution (no anon table access; sanitized payload)
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_project(link_token text)
returns table (project_name text, doc jsonb, mode text)
language sql stable security definer set search_path = public as $$
  select p.name, p.doc, l.mode
  from public.shared_links l
  join public.projects p on p.id = l.project_id
  where l.token = link_token
    and not l.revoked
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke all on function public.get_shared_project(text) from public;
grant execute on function public.get_shared_project(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('user-assets', 'user-assets', false, 10485760,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('user-fonts', 'user-fonts', false, 5242880,
   array['font/ttf', 'font/otf', 'font/woff', 'application/octet-stream']),
  ('template-assets', 'template-assets', true, 10485760,
   array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- Object keys are namespaced by the owner's uid: {uid}/{asset-id}.
create policy user_assets_rw on storage.objects
  for all using (
    bucket_id = 'user-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy user_fonts_rw on storage.objects
  for all using (
    bucket_id = 'user-fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-fonts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy template_assets_read on storage.objects
  for select using (bucket_id = 'template-assets');
create policy template_assets_admin_write on storage.objects
  for insert with check (bucket_id = 'template-assets' and public.is_admin());
create policy template_assets_admin_update on storage.objects
  for update using (bucket_id = 'template-assets' and public.is_admin());
create policy template_assets_admin_delete on storage.objects
  for delete using (bucket_id = 'template-assets' and public.is_admin());
