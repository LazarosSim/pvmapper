-- Add archived column to parks table
ALTER TABLE parks ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE parks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient filtering of non-archived parks
CREATE INDEX IF NOT EXISTS idx_parks_archived ON parks(archived);

-- Update the park_stats view to include archived fields
DROP VIEW IF EXISTS park_stats;
CREATE VIEW park_stats AS
SELECT 
  p.id,
  p.name,
  p.expected_barcodes,
  COALESCE(SUM(r.current_barcodes), 0)::bigint AS current_barcodes,
  p.created_at,
  p.user_id AS created_by,
  p.validate_barcode_length,
  p.archived,
  p.archived_at
FROM parks p
LEFT JOIN rows r ON r.park_id = p.id
GROUP BY p.id, p.name, p.expected_barcodes, p.created_at, p.user_id, p.validate_barcode_length, p.archived, p.archived_at;