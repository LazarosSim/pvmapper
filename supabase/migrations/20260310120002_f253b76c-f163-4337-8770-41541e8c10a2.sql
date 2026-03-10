CREATE OR REPLACE FUNCTION public.reset_row_barcodes(p_row_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM barcodes WHERE row_id = p_row_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;