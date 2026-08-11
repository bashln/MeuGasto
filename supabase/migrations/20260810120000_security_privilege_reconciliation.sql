-- Reconcile privileges found in the remote schema dump on 2026-08-10.
-- The remote database already records migration 20260617172638, so this
-- migration contains only the corrective changes that follow that baseline.

BEGIN;

-- Policy helpers and trigger functions are not client-callable RPCs.
REVOKE ALL ON FUNCTION public.can_reference_supermarket(INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_reference_supermarket(INTEGER)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.enforce_comparison_quote_items_limit()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_comparison_quotes_limit()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_items_per_purchase_limit()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_owned_row_quota()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_shopping_list_items_limit()
  FROM PUBLIC, anon, authenticated;

-- Analytics are written by trusted jobs and read only by the dedicated
-- analytics role. Client roles need no table or sequence privileges here.
REVOKE ALL ON TABLE public.analytics_item_prices,
  public.analytics_market_baskets,
  public.analytics_price_trends
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.analytics_item_prices_id_seq,
  public.analytics_market_baskets_id_seq,
  public.analytics_price_trends_id_seq
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.analytics_item_prices,
  public.analytics_market_baskets,
  public.analytics_price_trends
  TO service_role;
GRANT SELECT ON TABLE public.analytics_item_prices,
  public.analytics_market_baskets,
  public.analytics_price_trends
  TO analytics_reader;

-- Prevent future objects created by postgres in public from inheriting
-- client access. New client-facing objects must receive explicit grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;
