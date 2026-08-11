-- Remediação de drift remoto detectado pelo Supabase Security Advisor.
-- Executar via `supabase db query --linked --file ...`.
-- Não altera dados; apenas reduz a superfície RPC e fixa search_path.

DO $$
DECLARE
  v_function RECORD;
BEGIN
  FOR v_function IN
    SELECT
      p.proname,
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_catalog.pg_get_function_identity_arguments(p.oid)
      ) AS signature
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
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public',
      v_function.signature
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',
      v_function.signature
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
      v_function.signature
    );
  END LOOP;

  FOR v_function IN
    SELECT
      p.proname,
      format(
        '%I.%I(%s)',
        n.nspname,
        p.proname,
        pg_catalog.pg_get_function_identity_arguments(p.oid)
      ) AS signature
    FROM pg_catalog.pg_proc p
    INNER JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'handle_new_user',
        'prevent_imported_purchase_updates',
        'prevent_role_escalation',
        'rls_auto_enable'
      )
  LOOP
    IF v_function.proname = 'rls_auto_enable' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog', v_function.signature);
    ELSE
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public', v_function.signature);
    END IF;

    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
  END LOOP;
END;
$$;
