-- Phase 1 security fix. Written against the live schema as of 2026-10-02.
-- Compatible with the app currently in production: approved users keep every
-- ability they use today; anonymous visitors and pending accounts lose access.
--
-- What it changes:
--   1. New sign-ups become 'pending' (the client no longer chooses its role).
--   2. Nobody can change their own role; managers approve accounts with approve_user().
--   3. Data is no longer readable without logging in (was "viewable by everyone").
--   4. Only approved users can read or change data; parks are managed by managers;
--      rows with a target barcode count can only be deleted by managers (as in the UI).
--   5. reset_row_barcodes() could be called by anyone, even logged out: now approved users only.
--   6. The stats views respect these rules.

begin;

-- 1. Roles ---------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('pending', 'user', 'manager'));

create or replace function public.is_manager()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

create or replace function public.is_approved()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('user', 'manager'));
$$;

-- Previously took the role from the sign-up request, so anyone could register as a manager.
create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    'pending'
  );
  return new;
end;
$$;

-- "Users can update their own profile" had no column restriction, so users could make
-- themselves managers. Role changes from the API are now rejected; approve_user() and
-- the SQL editor run as the database owner and are not affected.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role and current_user in ('authenticated', 'anon') then
    raise exception 'Roles can only be changed by a manager' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

create or replace function public.approve_user(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_manager() then
    raise exception 'Only managers can approve accounts' using errcode = '42501';
  end if;
  update public.profiles set role = 'user' where id = p_user_id and role = 'pending';
end;
$$;

revoke execute on function public.approve_user(uuid) from public, anon;
grant execute on function public.approve_user(uuid) to authenticated;

-- 2. Row level security ----------------------------------------------------------
-- (select fn()) is evaluated once per query instead of once per row.

-- barcodes: approved users scan, edit, delete and reset rows (unchanged for them)
drop policy if exists "Barcodes are viewable by everyone" on public.barcodes;
drop policy if exists "Barcodes can be inserted by authenticated users" on public.barcodes;
drop policy if exists "Barcodes can be updated by any authenticated user" on public.barcodes;
drop policy if exists "Barcodes can be deleted by any authenticated user" on public.barcodes;

create policy "Approved users can read barcodes" on public.barcodes
  for select to authenticated using ((select public.is_approved()));
create policy "Approved users can add barcodes" on public.barcodes
  for insert to authenticated with check ((select public.is_approved()));
create policy "Approved users can edit barcodes" on public.barcodes
  for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
create policy "Approved users can delete barcodes" on public.barcodes
  for delete to authenticated using ((select public.is_approved()));

-- rows: approved users add, rename and edit rows (as today); deleting a row with a
-- target count is manager-only, matching the rule the app already applies
drop policy if exists "Rows are viewable by everyone" on public.rows;
drop policy if exists "Rows can be inserted by authenticated users" on public.rows;
drop policy if exists "Rows can be updated by any authenticated user" on public.rows;
drop policy if exists "Rows can be deleted by any authenticated user" on public.rows;

create policy "Approved users can read rows" on public.rows
  for select to authenticated using ((select public.is_approved()));
create policy "Approved users can add rows" on public.rows
  for insert to authenticated with check ((select public.is_approved()));
create policy "Approved users can edit rows" on public.rows
  for update to authenticated using ((select public.is_approved())) with check ((select public.is_approved()));
create policy "Rows with a target count are deleted by managers" on public.rows
  for delete to authenticated
  using ((select public.is_manager()) or ((select public.is_approved()) and expected_barcodes is null));

-- parks: read by approved users; created, edited, archived and deleted by managers
-- (the app only offers these actions to managers)
drop policy if exists "Parks are viewable by everyone" on public.parks;
drop policy if exists "Parks can be inserted by authenticated users" on public.parks;
drop policy if exists "Parks can be updated by managers or creator" on public.parks;
drop policy if exists "Parks can be deleted by managers or creator" on public.parks;

create policy "Approved users can read parks" on public.parks
  for select to authenticated using ((select public.is_approved()));
create policy "Managers can add parks" on public.parks
  for insert to authenticated with check ((select public.is_manager()));
create policy "Managers can edit parks" on public.parks
  for update to authenticated using ((select public.is_manager())) with check ((select public.is_manager()));
create policy "Managers can delete parks" on public.parks
  for delete to authenticated using ((select public.is_manager()));

-- daily_scans: duplicate policies merged; still written by the app for the signed-in user
drop policy if exists "Daily scans are viewable by everyone" on public.daily_scans;
drop policy if exists "Managers can view all daily scans" on public.daily_scans;
drop policy if exists "Users can view their own daily scans" on public.daily_scans;
drop policy if exists "Daily scans can be inserted by authenticated users" on public.daily_scans;
drop policy if exists "Users can insert their own daily scans" on public.daily_scans;
drop policy if exists "Daily scans can be updated by the owner" on public.daily_scans;
drop policy if exists "Users can update their own daily scans" on public.daily_scans;

create policy "Approved users can read daily scans" on public.daily_scans
  for select to authenticated using ((select public.is_approved()));
create policy "Approved users record their own daily scans" on public.daily_scans
  for insert to authenticated with check ((select public.is_approved()) and user_id = (select auth.uid()));
create policy "Approved users update their own daily scans" on public.daily_scans
  for update to authenticated
  using ((select public.is_approved()) and user_id = (select auth.uid()))
  with check ((select public.is_approved()) and user_id = (select auth.uid()));

-- profiles: everyone signed in can read their own profile (pending users need it to see
-- they are waiting); approved users can read all (usernames in stats)
drop policy if exists "Users can view all profiles" on public.profiles;
create policy "Users read their own profile, approved users read all" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_approved()));

-- 3. Functions that bypassed the rules ------------------------------------------

-- Security definer and executable by anyone, including logged-out visitors.
create or replace function public.reset_row_barcodes(p_row_id uuid)
returns integer
language plpgsql security definer
set statement_timeout = '120s'
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not public.is_approved() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from barcodes where row_id = p_row_id;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke execute on function public.reset_row_barcodes(uuid) from public, anon;
grant execute on function public.reset_row_barcodes(uuid) to authenticated;

-- Unused by the app; returned account emails to logged-out visitors.
revoke execute on function public.get_email_by_username(text) from public, anon;

-- 4. Views run with the reader's permissions instead of the owner's -------------------
alter view public.park_stats set (security_invoker = on);
alter view public.user_stats set (security_invoker = on);

commit;
