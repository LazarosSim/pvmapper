-- Phase 1/2 performance fix. Written against the live schema as of 2026-10-02.
-- No data changes.
--
-- barcodes (323k rows) had no index on row_id, and three triggers recalculated a row's
-- count after every scan, two of them on each insert/delete. Each recount read the whole
-- barcodes table, so every saved scan scanned 67 MB twice.

begin;

-- Loading a row's barcodes, the row count trigger and reset all filter on row_id
create index if not exists barcodes_row_id_order_idx on public.barcodes (row_id, order_in_row);

-- Loading a park's rows
create index if not exists rows_park_id_idx on public.rows (park_id);

-- Per-user statistics (user_stats view)
create index if not exists barcodes_user_id_timestamp_idx on public.barcodes (user_id, "timestamp");

-- trigger_update_row_barcode_count (AFTER INSERT OR DELETE) stays; these two ran the
-- same function a second time for the same event.
drop trigger if exists update_row_barcode_count_after_insert on public.barcodes;
drop trigger if exists update_row_barcode_count_after_delete on public.barcodes;

commit;
