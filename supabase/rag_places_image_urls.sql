-- Add image_urls column to store up to 3 cached photo URLs per place
ALTER TABLE rag_places ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
