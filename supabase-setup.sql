-- Cole isto no Supabase: SQL Editor → New query → Run.
-- Depois crie o usuário em Authentication → Users → Add user.
-- E-mail: maya@mayagarden.local  (entra no sistema com o usuário "maya")
-- Marque "Auto Confirm". Senha com pelo menos 6 caracteres.

create table if not exists public.maya_user_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  role text not null default 'visitante' check (role in ('admin','empresa','visitante')),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maya_workspace_data (
  workspace_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.maya_user_access enable row level security;
alter table public.maya_workspace_data enable row level security;

create or replace function public.maya_has_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.maya_user_access
    where role = 'admin' and active is not false
  );
$$;

create or replace function public.maya_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.maya_user_access
  where user_id = auth.uid()
    and active is not false
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.maya_user_access to authenticated;
grant select, insert, update, delete on public.maya_workspace_data to authenticated;

drop policy if exists maya_access_select on public.maya_user_access;
create policy maya_access_select on public.maya_user_access
  for select to authenticated
  using (user_id = auth.uid() or public.maya_my_role() = 'admin');

drop policy if exists maya_access_bootstrap on public.maya_user_access;
create policy maya_access_bootstrap on public.maya_user_access
  for insert to authenticated
  with check (user_id = auth.uid() and role = 'admin' and not public.maya_has_admin());

drop policy if exists maya_data_select on public.maya_workspace_data;
create policy maya_data_select on public.maya_workspace_data
  for select to authenticated
  using (public.maya_my_role() in ('admin','empresa','visitante'));

drop policy if exists maya_data_insert on public.maya_workspace_data;
create policy maya_data_insert on public.maya_workspace_data
  for insert to authenticated
  with check (public.maya_my_role() in ('admin','empresa'));

drop policy if exists maya_data_update on public.maya_workspace_data;
create policy maya_data_update on public.maya_workspace_data
  for update to authenticated
  using (public.maya_my_role() in ('admin','empresa'))
  with check (public.maya_my_role() in ('admin','empresa'));
