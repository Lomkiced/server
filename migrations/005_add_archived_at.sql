-- Add archived_at column
ALTER TABLE records ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- Add updated_at column (since it was missing)
ALTER TABLE records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill archived_at for existing archived records
-- We default to uploaded_at since we don't have better history
UPDATE records 
SET archived_at = uploaded_at 
WHERE status = 'Archived' AND archived_at IS NULL;
