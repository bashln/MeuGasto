-- Run only after applying supabase_security_hardening_migration.sql to staging.
-- The transaction is read-only in effect and always rolls back.

BEGIN;

DO $$
DECLARE
  v_rate_limit_trigger_count INTEGER;
  v_rls_enabled BOOLEAN;
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
