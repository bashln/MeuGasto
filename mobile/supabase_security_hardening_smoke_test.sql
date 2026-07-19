-- Run only after applying supabase_security_hardening_migration.sql to staging.
-- The transaction is read-only in effect and always rolls back.

BEGIN;

DO $$
DECLARE
  v_rate_limit_trigger_count INTEGER;
  v_rls_enabled BOOLEAN;
  v_test_user UUID := '00000000-0000-4000-8000-000000000001';
  v_test_action TEXT := 'smoke_test:INSERT';
  v_test_window TIMESTAMPTZ := '2026-01-01T00:00:00Z';
  v_request_count INTEGER;
BEGIN
  IF to_regclass('private.authenticated_write_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'Rate limit table was not created';
  END IF;

  SELECT c.relrowsecurity
  INTO v_rls_enabled
  FROM pg_catalog.pg_class c
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private'
    AND c.relname = 'authenticated_write_rate_limits';

  IF v_rls_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'RLS is not enabled on the rate limit table';
  END IF;

  IF has_schema_privilege('anon', 'private', 'USAGE')
    OR has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'Client roles can use the private schema';
  END IF;

  IF has_function_privilege(
    'anon',
    'private.enforce_authenticated_write_rate_limit()',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'private.enforce_authenticated_write_rate_limit()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Client roles can execute the privileged rate limit function';
  END IF;

  PERFORM private.consume_authenticated_write_budget(
    v_test_user,
    v_test_action,
    3,
    v_test_window
  );
  PERFORM private.consume_authenticated_write_budget(
    v_test_user,
    v_test_action,
    3,
    v_test_window + INTERVAL '1 minute'
  );
  PERFORM private.consume_authenticated_write_budget(
    v_test_user,
    v_test_action,
    3,
    v_test_window + INTERVAL '2 minutes'
  );

  BEGIN
    PERFORM private.consume_authenticated_write_budget(
      v_test_user,
      v_test_action,
      3,
      v_test_window + INTERVAL '3 minutes'
    );
    RAISE EXCEPTION 'Rate limit did not reject the fourth request';
  EXCEPTION
    WHEN program_limit_exceeded THEN NULL;
  END;

  PERFORM private.consume_authenticated_write_budget(
    v_test_user,
    v_test_action,
    3,
    v_test_window + INTERVAL '61 minutes'
  );

  SELECT request_count
  INTO v_request_count
  FROM private.authenticated_write_rate_limits
  WHERE user_id = v_test_user
    AND action = v_test_action;

  IF v_request_count <> 1 THEN
    RAISE EXCEPTION 'Rate limit window did not reset, count is %', v_request_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
  ) THEN
    RAISE EXCEPTION 'A public SECURITY DEFINER function is client-executable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_purchase_with_items',
        'get_item_average_price',
        'get_items_average_prices_bulk',
        'is_valid_draft_content',
        'is_valid_draft_items',
        'normalize_draft_content',
        'report_expenses_by_supermarket',
        'report_top_items'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS setting
        WHERE setting = 'search_path=pg_catalog, public'
      )
  ) THEN
    RAISE EXCEPTION 'An application function has a mutable search_path';
  END IF;

  SELECT count(*)
  INTO v_rate_limit_trigger_count
  FROM pg_catalog.pg_trigger t
  INNER JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND t.tgname LIKE 'enforce_%_write_rate_limit';

  IF v_rate_limit_trigger_count <> 7 THEN
    RAISE EXCEPTION 'Expected 7 write rate limit triggers, found %',
      v_rate_limit_trigger_count;
  END IF;
END;
$$;

ROLLBACK;
