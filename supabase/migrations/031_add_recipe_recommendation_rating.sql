-- Add recommendation_rating column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS recommendation_rating INTEGER DEFAULT 5 CHECK (recommendation_rating >= 0 AND recommendation_rating <= 5);

-- Update existing recipes to have a default rating of 5 if they don't have one
UPDATE recipes SET recommendation_rating = 5 WHERE recommendation_rating IS NULL;
