-- Existing draft values are deliberately preserved. New editable drafts may remain unselected.
ALTER TABLE "ListingDraft"
  ALTER COLUMN "requestedPromotionTier" DROP DEFAULT,
  ALTER COLUMN "requestedPromotionTier" DROP NOT NULL;

-- Product tier is copied only from its authoritative source draft; there is no fallback.
ALTER TABLE "Product" ADD COLUMN "listingTier" "ListingDraftPromotionPreference";

UPDATE "Product" AS product
SET "listingTier" = draft."requestedPromotionTier"
FROM "ListingDraft" AS draft
WHERE product."sourceListingDraftId" = draft."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE "listingTier" IS NULL) THEN
    RAISE EXCEPTION 'LISTING_TIER_PRODUCT_BACKFILL_INCOMPLETE';
  END IF;
END $$;

ALTER TABLE "Product" ALTER COLUMN "listingTier" SET NOT NULL;
