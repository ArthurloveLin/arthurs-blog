-- Add rank column to items table
-- 1: Champion, 2: Runner-up, 3: Third Place
ALTER TABLE items ADD COLUMN IF NOT EXISTS rank integer;

-- Update RLS if needed (usually columns are covered by table-level RLS)
COMMENT ON COLUMN items.rank IS 'Ranking from tournament (1=Gold, 2=Silver, 3=Bronze)';
