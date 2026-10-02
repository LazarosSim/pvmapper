-- Row versions for the phones' offline copies, row counts kept right on edits too, inserting a
-- barcode at a position in one step, and statistics from existing barcodes by Greek date.
-- No data changes.

-- 1. A row's version changes whenever the row or one of its barcodes changes, so phones
--    re-download only the rows whose version differs from their copy.
alter table public.rows add column if not exists version bigint not null default 0;

create or replace function public.bump_row_version()
returns trigger
language plpgsql
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

create trigger bump_row_version
  before update on public.rows
  for each row execute function public.bump_row_version();

-- 2. The row-count function also handles edits (a barcode moved to another row), and an
--    AFTER UPDATE trigger runs it, so edits bump the row's version too. The existing insert
--    and delete triggers stay (see supabase/pending/02_trigger_cleanup.sql); a recount is
--    cheap now that barcodes(row_id) is indexed.
create or replace function public.update_row_barcode_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update rows set current_barcodes = (select count(*) from barcodes where row_id = old.row_id)
    where id = old.row_id;
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.row_id is distinct from old.row_id) then
    update rows set current_barcodes = (select count(*) from barcodes where row_id = new.row_id)
    where id = new.row_id;
  end if;
  return null;
end;
$$;

create trigger update_row_barcode_count_after_update
  after update on public.barcodes
  for each row execute function public.update_row_barcode_count();

-- 3. Insert a barcode at a position in one step (was: shift, then insert, as two requests).
--    Safe to retry: a barcode that already exists is neither inserted nor shifted again.
create or replace function public.insert_barcode_at(
  p_id uuid,
  p_row_id uuid,
  p_position bigint,
  p_code text,
  p_user_id uuid,
  p_timestamp timestamptz default now(),
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  -- One insert at a time per row
  perform 1 from rows where id = p_row_id for update;
  if exists (select 1 from barcodes where id = p_id) then
    return;
  end if;
  update barcodes set order_in_row = order_in_row + 1
  where row_id = p_row_id and order_in_row >= p_position;
  insert into barcodes (id, code, row_id, user_id, order_in_row, "timestamp", latitude, longitude)
  values (p_id, p_code, p_row_id, p_user_id, p_position, p_timestamp, p_latitude, p_longitude);
end;
$$;

-- 4. Statistics count the barcodes that currently exist, by date in Greece.
create or replace view public.daily_user_scans as
select
  b.user_id,
  p.username,
  (b."timestamp" at time zone 'Europe/Athens')::date as day,
  count(*)::bigint as scans
from public.barcodes b
join public.profiles p on p.id = b.user_id
group by b.user_id, p.username, (b."timestamp" at time zone 'Europe/Athens')::date;

-- Same columns as before; days are now Greek dates instead of UTC dates.
create or replace view public.user_stats as
with per_day as (
  select b.user_id, (b."timestamp" at time zone 'Europe/Athens')::date as day, count(*) as scans
  from public.barcodes b
  group by 1, 2
)
select
  p.username,
  sum(d.scans)::bigint as total_scans,
  (sum(d.scans)::bigint / count(*)) as average_daily_scans,
  count(*) as days_active,
  coalesce(sum(d.scans) filter (where d.day = (now() at time zone 'Europe/Athens')::date), 0)::bigint as daily_scans
from per_day d
join public.profiles p on p.id = d.user_id
group by p.username
order by p.username desc;
