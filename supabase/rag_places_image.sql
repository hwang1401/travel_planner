-- Add image_url column to rag_places for storing Supabase Storage public URLs
-- Run this in Supabase Dashboard SQL Editor

ALTER TABLE rag_places
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN rag_places.image_url IS 'Supabase Storage public URL for place photo (uploaded from Google Places Photos API)';
