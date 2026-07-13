-- Forge Labels — team collaboration UI support.
--
-- 1) Organization owners are implicit members: the original is_org_member()
--    only consulted organization_members, so an owner who never inserted a
--    membership row for themselves couldn't see org projects, manage members
--    (the members-table write policy calls is_org_member), or create
--    invitations. Owners now rank as 'owner' automatically.
--
-- 2) get_org_members(): the team page needs member emails, but profiles are
--    self-readable only under RLS. This security-definer directory returns
--    members (owner included) strictly for callers who belong to the org.

create or replace function public.is_org_member(target_org uuid, min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = target_org and o.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.organization_members m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and public.org_role_rank(m.role) >= public.org_role_rank(min_role)
  );
$$;

create or replace function public.get_org_members(target_org uuid)
returns table (
  user_id uuid,
  role text,
  email text,
  display_name text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select o.owner_id, 'owner'::text, p.email, p.display_name, o.created_at
  from public.organizations o
  join public.profiles p on p.id = o.owner_id
  where o.id = target_org and public.is_org_member(target_org)
  union all
  select m.user_id, m.role, p.email, p.display_name, m.created_at
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  where m.org_id = target_org and public.is_org_member(target_org)
  order by joined_at;
$$;

revoke all on function public.get_org_members(uuid) from public;
grant execute on function public.get_org_members(uuid) to authenticated;
