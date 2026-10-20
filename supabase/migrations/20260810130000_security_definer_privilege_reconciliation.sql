-- Remove explicit client grants that can be inherited when functions are
-- created under permissive default privileges.

BEGIN;

REVOKE ALL ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_analytics_aggregation(DATE)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.run_analytics_aggregation(DATE)
  TO service_role;

COMMIT;
