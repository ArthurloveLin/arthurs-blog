ALTER TABLE items
ADD COLUMN IF NOT EXISTS ocr_status text DEFAULT 'idle';

ALTER TABLE items
ADD COLUMN IF NOT EXISTS ocr_provider text;

ALTER TABLE items
ADD COLUMN IF NOT EXISTS ocr_data jsonb;

ALTER TABLE items
ADD COLUMN IF NOT EXISTS ocr_processed_at timestamptz;

UPDATE items
SET ocr_status = 'idle'
WHERE ocr_status IS NULL;

ALTER TABLE items
ALTER COLUMN ocr_status SET DEFAULT 'idle';

ALTER TABLE items
ALTER COLUMN ocr_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_ocr_status_check'
  ) THEN
    ALTER TABLE items
    ADD CONSTRAINT items_ocr_status_check CHECK (ocr_status IN ('idle', 'pending', 'processing', 'completed', 'failed'));
  END IF;
END $$;
