-- Optional cleanup. Three triggers run the same row-count function on barcodes inserts and
-- deletes: trigger_update_row_barcode_count (INSERT OR DELETE) and the two below. Each
-- recount is correct but runs twice. Dropping the two duplicates halves the work.
-- No data changes. Needs approval because it drops triggers.

drop trigger if exists update_row_barcode_count_after_insert on public.barcodes;
drop trigger if exists update_row_barcode_count_after_delete on public.barcodes;

-- An unused function created while applying 20261002033100 (the trigger swap it was meant
-- for was replaced by the additive version in that migration).
drop function if exists public.refresh_row_after_barcode_change();
