-- Add gallery_images column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;
