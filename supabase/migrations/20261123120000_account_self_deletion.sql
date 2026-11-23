-- Exclusão de conta pelo próprio titular (LGPD art. 18, VI).
-- A função deriva o usuário de auth.uid(); nunca aceita id vindo do cliente.
-- A remoção em auth.users dispara as FKs ON DELETE CASCADE de profiles,
-- purchases, items, drafts, shopping_lists e comparações.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_dates date[];
  v_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  -- Buckets afetados são recomputados depois da exclusão, sem bloquear o
  -- direito do titular se a agregação falhar.
  SELECT array_agg(DISTINCT p.date)
    INTO v_dates
    FROM public.purchases p
   WHERE p.user_id = v_user_id;

  DELETE FROM auth.users WHERE id = v_user_id;

  IF v_dates IS NOT NULL THEN
    FOREACH v_date IN ARRAY v_dates LOOP
      BEGIN
        PERFORM public.run_analytics_aggregation(v_date);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END IF;
END;
$$;

ALTER FUNCTION public.delete_own_account() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS
  'Apaga a conta do usuário autenticado e os dados em cascata. Não aceita id externo.';

COMMIT;
