-- Drop the legacy 7-parameter create_purchase_with_items overload that accepted
-- caller-supplied p_user_id and persisted plaintext access_key without bounds
-- checks, and enforce defensive table constraints on new writes.

BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.create_purchase_with_items(uuid,integer,text,date,numeric,boolean,jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_purchase_with_items(
      UUID, INTEGER, TEXT, DATE, NUMERIC, BOOLEAN, JSONB
    ) FROM PUBLIC, anon, authenticated;

    DROP FUNCTION public.create_purchase_with_items(
      UUID, INTEGER, TEXT, DATE, NUMERIC, BOOLEAN, JSONB
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_no_plaintext_access_key_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_no_plaintext_access_key_check
      CHECK (access_key IS NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_total_price_bounds_check'
  ) THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_total_price_bounds_check
      CHECK (total_price >= 0 AND total_price <= 99999999.99) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_price_bounds_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_price_bounds_check
      CHECK (price >= 0 AND price <= 99999999.99) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_quantity_bounds_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_quantity_bounds_check
      CHECK (quantity > 0 AND quantity <= 99999) NOT VALID;
  END IF;
END
$$;

COMMIT;
