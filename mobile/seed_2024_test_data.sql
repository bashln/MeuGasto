-- =============================================
-- MeuGasto - Seed de teste para relatorios de 2024
-- Executar no Supabase SQL Editor
--
-- Antes de rodar:
-- 1. Troque `lpdmonteiro@gmail.com` pelo email do usuario que recebera os dados.
-- 2. O script e idempotente para este seed: ele remove as compras seedadas de 2024
--    com os supermercados `[Seed 2024] ...` antes de recriar tudo.
-- =============================================

BEGIN;

CREATE TEMP TABLE seed_2024_months (
  month_index INTEGER PRIMARY KEY,
  purchase_date DATE NOT NULL,
  market_name TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_2024_months (month_index, purchase_date, market_name) VALUES
  (1, DATE '2024-01-05', '[Seed 2024] Mercado Centro POA'),
  (2, DATE '2024-02-05', '[Seed 2024] Atacado Zona Sul POA'),
  (3, DATE '2024-03-05', '[Seed 2024] Feira Menino Deus POA'),
  (4, DATE '2024-04-05', '[Seed 2024] Mercado Centro POA'),
  (5, DATE '2024-05-05', '[Seed 2024] Atacado Zona Sul POA'),
  (6, DATE '2024-06-05', '[Seed 2024] Feira Menino Deus POA'),
  (7, DATE '2024-07-05', '[Seed 2024] Mercado Centro POA'),
  (8, DATE '2024-08-05', '[Seed 2024] Atacado Zona Sul POA'),
  (9, DATE '2024-09-05', '[Seed 2024] Feira Menino Deus POA'),
  (10, DATE '2024-10-05', '[Seed 2024] Mercado Centro POA'),
  (11, DATE '2024-11-05', '[Seed 2024] Atacado Zona Sul POA'),
  (12, DATE '2024-12-05', '[Seed 2024] Feira Menino Deus POA');

CREATE TEMP TABLE seed_2024_catalog (
  sort_order INTEGER PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  month_costs NUMERIC[] NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_2024_catalog (sort_order, item_name, quantity, unit, month_costs) VALUES
  (1, 'Carne bovina de primeira', 6.6, 'kg', ARRAY[268.00, 270.00, 272.00, 274.00, 280.00, 285.00, 288.00, 290.00, 292.00, 294.00, 296.00, 298.00]),
  (2, 'Pao frances', 6.0, 'kg', ARRAY[99.00, 100.00, 101.00, 102.00, 103.00, 104.00, 105.00, 106.00, 107.00, 108.00, 110.00, 112.00]),
  (3, 'Tomate', 9.0, 'kg', ARRAY[75.00, 78.00, 80.00, 85.00, 95.00, 92.00, 88.00, 84.00, 82.00, 80.00, 78.00, 76.00]),
  (4, 'Batata', 6.0, 'kg', ARRAY[45.00, 46.00, 47.00, 50.00, 60.00, 62.00, 58.00, 54.00, 50.00, 48.00, 47.00, 46.00]),
  (5, 'Banana', 7.5, 'kg', ARRAY[49.00, 49.00, 50.00, 50.00, 51.00, 52.00, 53.00, 54.00, 55.00, 55.00, 56.00, 57.00]),
  (6, 'Manteiga', 0.75, 'kg', ARRAY[42.00, 42.00, 43.00, 43.00, 44.00, 45.00, 46.00, 47.00, 48.00, 49.00, 50.00, 50.00]),
  (7, 'Leite', 7.5, 'l', ARRAY[36.00, 36.00, 37.00, 37.00, 38.00, 39.00, 40.00, 41.00, 42.00, 43.00, 44.00, 45.00]),
  (8, 'Feijao', 4.5, 'kg', ARRAY[31.00, 31.00, 32.00, 32.00, 33.00, 34.00, 35.00, 36.00, 37.00, 38.00, 39.00, 40.00]),
  (9, 'Cafe em po', 0.6, 'kg', ARRAY[26.00, 26.00, 27.00, 28.00, 29.00, 30.00, 31.00, 32.00, 33.00, 34.00, 35.00, 35.00]),
  (10, 'Arroz', 3.0, 'kg', ARRAY[20.00, 20.00, 21.00, 23.00, 27.00, 26.00, 25.00, 24.00, 23.00, 22.00, 21.00, 20.00]),
  (11, 'Acucar', 3.0, 'kg', ARRAY[15.00, 15.00, 16.00, 16.00, 17.00, 17.00, 18.00, 18.00, 19.00, 19.00, 20.00, 20.00]),
  (12, 'Oleo de soja 900ml', 1.0, 'un', ARRAY[8.00, 8.00, 8.00, 9.00, 9.00, 9.00, 9.00, 10.00, 10.00, 10.00, 10.00, 10.00]),
  (13, 'Farinha de trigo', 1.5, 'kg', ARRAY[7.00, 7.00, 8.00, 8.00, 8.00, 9.00, 9.00, 9.00, 10.00, 10.00, 10.00, 10.00]);

DO $$
DECLARE
  -- Preencha apenas esta linha com o email do usuario alvo.
  v_user_email TEXT := 'lpdmonteiro@gmail.com';
  v_user_id UUID;
  v_market_name TEXT;
  v_month RECORD;
  v_item RECORD;
  v_purchase_id INTEGER;
  v_market_id INTEGER;
  v_unit_price NUMERIC(10, 2);
  v_average_total NUMERIC(10, 2);
BEGIN
  v_user_email := lower(btrim(v_user_email));

  IF v_user_email IS NULL OR v_user_email = '' THEN
    RAISE EXCEPTION 'Preencha v_user_email com o email do usuario antes de executar o seed';
  END IF;

  SELECT id
    INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(v_user_email)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuario encontrado com o email %', v_user_email;
  END IF;

  FOR v_market_name IN
    SELECT DISTINCT market_name
      FROM seed_2024_months
     ORDER BY market_name
  LOOP
    INSERT INTO public.supermarkets (
      user_id,
      name,
      city,
      state,
      manual
    )
    SELECT
      v_user_id,
      v_market_name,
      'Porto Alegre',
      'RS',
      TRUE
    WHERE NOT EXISTS (
      SELECT 1
        FROM public.supermarkets s
       WHERE s.user_id = v_user_id
         AND s.name = v_market_name
    );
  END LOOP;

  DELETE FROM public.purchases p
   USING public.supermarkets s
   WHERE p.user_id = v_user_id
     AND p.supermarket_id = s.id
     AND p.date BETWEEN DATE '2024-01-01' AND DATE '2024-12-31'
     AND s.user_id = v_user_id
     AND s.name IN (SELECT DISTINCT market_name FROM seed_2024_months);

  FOR v_month IN
    SELECT *
      FROM seed_2024_months
     ORDER BY month_index
  LOOP
    SELECT id
      INTO v_market_id
      FROM public.supermarkets
     WHERE user_id = v_user_id
       AND name = v_month.market_name
     ORDER BY id
     LIMIT 1;

    INSERT INTO public.purchases (
      user_id,
      supermarket_id,
      access_key,
      date,
      total_price,
      manual
    )
    VALUES (
      v_user_id,
      v_market_id,
      NULL,
      v_month.purchase_date,
      0,
      TRUE
    )
    RETURNING id INTO v_purchase_id;

    FOR v_item IN
      SELECT *
        FROM seed_2024_catalog
       ORDER BY sort_order
    LOOP
      v_unit_price := ROUND((v_item.month_costs[v_month.month_index] / v_item.quantity)::NUMERIC, 2);

      INSERT INTO public.items (
        purchase_id,
        name,
        code,
        quantity,
        unit,
        price
      )
      VALUES (
        v_purchase_id,
        v_item.item_name,
        NULL,
        v_item.quantity,
        v_item.unit,
        v_unit_price
      );
    END LOOP;

    UPDATE public.purchases
       SET total_price = totals.total_price,
           updated_at = NOW()
      FROM (
        SELECT ROUND(COALESCE(SUM(i.quantity * i.price), 0), 2) AS total_price
          FROM public.items i
         WHERE i.purchase_id = v_purchase_id
      ) AS totals
     WHERE id = v_purchase_id;
  END LOOP;

  SELECT ROUND(AVG(total_price), 2)
    INTO v_average_total
    FROM public.purchases p
    JOIN public.supermarkets s ON s.id = p.supermarket_id
   WHERE p.user_id = v_user_id
     AND p.date BETWEEN DATE '2024-01-01' AND DATE '2024-12-31'
     AND s.name IN (SELECT DISTINCT market_name FROM seed_2024_months);

  RAISE NOTICE 'Seed 2024 aplicado para %', v_user_email;
  RAISE NOTICE 'Compras criadas: 12';
  RAISE NOTICE 'Media mensal aproximada da cesta seedada: R$ %', v_average_total;
END;
$$;

COMMIT;
