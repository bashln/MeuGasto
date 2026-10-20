-- Remote RLS integration test for MeuGasto.
-- Execute with: supabase db query --linked --file mobile/supabase_security_rls_integration_test.sql
-- All fixture rows and rate-limit counters are removed by the final ROLLBACK.

BEGIN;

DO $$
BEGIN
  IF to_regclass('private.authenticated_write_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'Rate-limit table is missing';
  END IF;

  IF to_regclass('public.analytics_item_prices') IS NULL
    OR to_regclass('public.analytics_market_baskets') IS NULL
    OR to_regclass('public.analytics_price_trends') IS NULL
    OR to_regclass('public.sensitive_access_audit') IS NULL THEN
    RAISE EXCEPTION 'Privacy tables are missing';
  END IF;
END;
$$;

-- Seed deterministic, non-production fixture rows while bypassing foreign-key
-- checks and write triggers. RLS is exercised only after the role is switched.
SET LOCAL session_replication_role = replica;

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-4000-8000-000000000101',
    'authenticated',
    'authenticated',
    'rls-test-user-a@example.invalid',
    '',
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'authenticated',
    'authenticated',
    'rls-test-user-b@example.invalid',
    '',
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    NOW(),
    NOW()
  );

INSERT INTO public.profiles (id, name, role)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'RLS test user A', 'user'),
  ('00000000-0000-4000-8000-000000000102', 'RLS test user B', 'user');

INSERT INTO public.supermarkets (id, user_id, name, manual)
VALUES (-900003, '00000000-0000-4000-8000-000000000102', 'RLS test market B', true);

INSERT INTO public.purchases (id, user_id, supermarket_id, date, total_price, manual)
VALUES
  (-900001, '00000000-0000-4000-8000-000000000101', NULL, CURRENT_DATE, 10, true),
  (-900002, '00000000-0000-4000-8000-000000000102', -900003, CURRENT_DATE, 20, true);

INSERT INTO public.items (id, purchase_id, name, quantity, unit, price)
VALUES
  (-900001, -900001, 'RLS test item A', 1, 'UN', 10),
  (-900002, -900002, 'RLS test item B', 1, 'UN', 20);

INSERT INTO public.shopping_lists (id, user_id, name, status)
VALUES
  (-900001, '00000000-0000-4000-8000-000000000101', 'RLS test list A', 'active'),
  (-900002, '00000000-0000-4000-8000-000000000102', 'RLS test list B', 'active');

INSERT INTO public.shopping_list_items (id, shopping_list_id, name, quantity, unit, estimated_price)
VALUES
  (-900001, -900001, 'RLS test list item A', 1, 'UN', 10),
  (-900002, -900002, 'RLS test list item B', 1, 'UN', 20);

-- User B has exactly the shopping-list quota before its attempted write.
INSERT INTO public.shopping_lists (id, user_id, name, status)
SELECT
  -910000 - series,
  '00000000-0000-4000-8000-000000000102',
  'RLS quota fixture ' || series,
  'active'
FROM generate_series(1, 999) AS series;

SET LOCAL session_replication_role = origin;

-- User A can access its rows, but cannot read or modify user B's rows.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000101')
    OR NOT EXISTS (SELECT 1 FROM public.purchases WHERE id = -900001)
    OR NOT EXISTS (SELECT 1 FROM public.items WHERE id = -900001)
    OR NOT EXISTS (SELECT 1 FROM public.shopping_lists WHERE id = -900001)
    OR NOT EXISTS (SELECT 1 FROM public.shopping_list_items WHERE id = -900001) THEN
    RAISE EXCEPTION 'User A cannot access its own fixture rows';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-4000-8000-000000000102')
    OR EXISTS (SELECT 1 FROM public.purchases WHERE id = -900002)
    OR EXISTS (SELECT 1 FROM public.items WHERE id = -900002)
    OR EXISTS (SELECT 1 FROM public.shopping_lists WHERE id = -900002)
    OR EXISTS (SELECT 1 FROM public.shopping_list_items WHERE id = -900002) THEN
    RAISE EXCEPTION 'User A can read user B fixture rows';
  END IF;

  UPDATE public.profiles SET name = 'unexpected' WHERE id = '00000000-0000-4000-8000-000000000102';
  IF FOUND THEN RAISE EXCEPTION 'User A updated user B profile'; END IF;
  UPDATE public.purchases SET total_price = 999 WHERE id = -900002;
  IF FOUND THEN RAISE EXCEPTION 'User A updated user B purchase'; END IF;
  UPDATE public.items SET price = 999 WHERE id = -900002;
  IF FOUND THEN RAISE EXCEPTION 'User A updated user B item'; END IF;
  UPDATE public.shopping_lists SET name = 'unexpected' WHERE id = -900002;
  IF FOUND THEN RAISE EXCEPTION 'User A updated user B shopping list'; END IF;
  UPDATE public.shopping_list_items SET name = 'unexpected' WHERE id = -900002;
  IF FOUND THEN RAISE EXCEPTION 'User A updated user B shopping-list item'; END IF;
END;
$$;

-- The client-callable purchase RPC must reject a supermarket owned by user B.
DO $$
DECLARE
  v_rejected BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.create_purchase_with_items(-900003, NULL, CURRENT_DATE, 1, true, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Purchase RPC accepted user B supermarket for user A';
  END IF;
END;
$$;

-- The rate-limit trigger, rather than its private helper, rejects write 241.
DO $$
DECLARE
  v_rejected BOOLEAN := false;
  v_index INTEGER;
BEGIN
  FOR v_index IN 1..241 LOOP
    BEGIN
      INSERT INTO public.shopping_lists (user_id, name, status)
      VALUES ('00000000-0000-4000-8000-000000000101', 'RLS rate test ' || v_index, 'active');
    EXCEPTION WHEN program_limit_exceeded THEN
      IF v_index <> 241 THEN
        RAISE EXCEPTION 'Rate limit rejected write % instead of 241', v_index;
      END IF;
      v_rejected := true;
      EXIT;
    END;
  END LOOP;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Rate-limit trigger did not reject write 241';
  END IF;
END;
$$;

-- User B's 1,000 existing lists force the real quota trigger to reject a write.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000102', true);

DO $$
BEGIN
  BEGIN
    INSERT INTO public.shopping_lists (user_id, name, status)
    VALUES ('00000000-0000-4000-8000-000000000102', 'RLS quota overflow', 'active');
    RAISE EXCEPTION 'Quota trigger did not reject the 1,001st shopping list';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;

RESET ROLE;

-- Analytics, audit, and the private rate-limit table are inaccessible to anon
-- and authenticated clients at the database privilege boundary.
DO $$
DECLARE
  v_relation REGCLASS;
BEGIN
  FOREACH v_relation IN ARRAY ARRAY[
    'public.analytics_item_prices'::regclass,
    'public.analytics_market_baskets'::regclass,
    'public.analytics_price_trends'::regclass,
    'public.sensitive_access_audit'::regclass,
    'private.authenticated_write_rate_limits'::regclass
  ] LOOP
    IF has_table_privilege('anon', v_relation, 'SELECT, INSERT, UPDATE, DELETE')
      OR has_table_privilege('authenticated', v_relation, 'SELECT, INSERT, UPDATE, DELETE') THEN
      RAISE EXCEPTION 'Client role has table access to %', v_relation;
    END IF;
  END LOOP;
END;
$$;

ROLLBACK;
