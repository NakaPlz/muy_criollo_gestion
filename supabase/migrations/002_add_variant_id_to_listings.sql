-- Add external_variant_id to platform_listings
ALTER TABLE platform_listings ADD COLUMN IF NOT EXISTS external_variant_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_listings_external_variant_id ON platform_listings(external_variant_id);

-- Update existing listings to set external_variant_id = external_id 
-- for items that don't have variations (where external_variant_id is null)
-- This is a best-effort guess, strictly speaking we should check ML data, 
-- but for simple items external_id identifies the product completely.
