-- barcodes (323k rows) had no index on row_id, so each of the row-count triggers read the
-- whole barcodes table after every scan. No data changes.
-- (On the live project the indexes were built with CREATE INDEX CONCURRENTLY.)

create index if not exists barcodes_row_id_order_idx on public.barcodes (row_id, order_in_row);
create index if not exists rows_park_id_idx on public.rows (park_id);
create index if not exists barcodes_user_id_timestamp_idx on public.barcodes (user_id, "timestamp");
