DO $$ BEGIN
 IF EXISTS(SELECT FROM analytics_item_prices WHERE normalized_item_name='stale') OR EXISTS(SELECT FROM analytics_price_trends WHERE normalized_item_name='stale') THEN RAISE EXCEPTION 'Historical ambiguous aggregates must be invalidated'; END IF;
END $$;
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT price_basis FROM items WHERE id=1) IS DISTINCT FROM 'unknown' THEN RAISE EXCEPTION 'Existing prices must remain unknown'; END IF;
 IF EXISTS (SELECT FROM public.report_top_items(10,NULL,NULL)) THEN RAISE EXCEPTION 'Unknown item prices must not enter reports'; END IF;
 IF public.get_item_average_price('Leite') IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Unknown item prices must not enter averages'; END IF;
END $$;
INSERT INTO items(purchase_id,name,normalized_name,quantity,unit,price,price_basis)
 VALUES (1,'Leite','leite',2,'UN',5,'unit'), (1,'Leite','leite',2,'UN',10,'line_total');
DO $$ BEGIN
 IF public.get_item_average_price('Leite') IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Average unit price must equal 5'; END IF;
 IF (SELECT avg_price FROM public.get_items_average_prices_bulk(ARRAY['Leite'])) IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Bulk average must equal 5'; END IF;
 IF (SELECT total FROM public.report_top_items(10,NULL,NULL)) IS DISTINCT FROM 20 THEN RAISE EXCEPTION 'Known line totals must sum to 20'; END IF;
 IF (SELECT quantity FROM public.report_top_items(10,NULL,NULL)) IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'Unknown quantities must not enter item reports'; END IF;
 IF (SELECT total FROM public.report_top_items(auth.uid(),10,NULL,NULL)) IS DISTINCT FROM 20 THEN RAISE EXCEPTION 'Legacy report must sum known line totals'; END IF;
 IF (SELECT price_basis FROM items WHERE price_basis = 'line_total' LIMIT 1) IS NOT NULL THEN RAISE EXCEPTION 'Server must normalize line totals for old readers'; END IF;
END $$;
SELECT public.create_purchase_with_items(NULL,NULL,'2026-11-08',10,false,
 '[{"name":"Marcado","quantity":2,"price":5,"price_basis":"unit"}]'::jsonb);
SELECT public.create_purchase_with_items(NULL,NULL,'2026-11-08',10,false,
 '[{"name":"Antigo","quantity":2,"price":5}]'::jsonb);
DO $$ BEGIN
 IF (SELECT price_basis FROM items WHERE name='Marcado') IS DISTINCT FROM 'unit' THEN RAISE EXCEPTION 'RPC must preserve explicit unit marker'; END IF;
 IF (SELECT price_basis FROM items WHERE name='Antigo') IS DISTINCT FROM 'unknown' THEN RAISE EXCEPTION 'Old RPC writers must remain unknown'; END IF;
END $$;

SELECT public.create_purchase_with_items(NULL,repeat('1',44),'2026-11-08',10,false,
 '[{"name":"Reimportado","quantity":3,"price":10}]'::jsonb);
SELECT public.create_purchase_with_items(NULL,repeat('1',44),'2026-11-08',10,false,
 '[{"name":"Reimportado","quantity":3,"price":3.33,"line_total":10,"price_basis":"unit"}]'::jsonb);
DO $$ BEGIN
 IF (SELECT count(*) FROM items WHERE name='Reimportado') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Reimport must replace unresolved items without duplication'; END IF;
 IF (SELECT price_basis FROM items WHERE name='Reimportado') IS DISTINCT FROM 'unit' THEN RAISE EXCEPTION 'Reimport must repair marker'; END IF;
 IF (SELECT line_total FROM items WHERE name='Reimportado') IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Reimport must preserve exact line total'; END IF;
 IF (SELECT total FROM public.report_top_items(100,NULL,NULL) WHERE name='Reimportado') IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Report must preserve exact line total'; END IF;
 IF public.get_item_average_price('Reimportado') IS DISTINCT FROM 3.33 THEN RAISE EXCEPTION 'Reimport average must use exact total'; END IF;
END $$;

DO $$ DECLARE n integer; purchase_id integer; BEGIN
 FOR n IN 1..5 LOOP
  INSERT INTO purchases(user_id,supermarket_id,date,total_price)
   VALUES ((lpad(n::text,32,'0'))::uuid,1,'2026-11-08',10) RETURNING id INTO purchase_id;
  INSERT INTO items(purchase_id,name,normalized_name,quantity,unit,price,price_basis,line_total)
   VALUES (purchase_id,'Analytics','analytics',2,'UN',5,'unit',10),
          (purchase_id,'Analytics','analytics',2,'UN',999,'unknown',NULL);
 END LOOP;
END $$;
SELECT public.run_analytics_aggregation('2026-11-08');
DO $$ BEGIN
 IF (SELECT avg_unit_price FROM analytics_item_prices WHERE normalized_item_name='analytics') IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Analytics unit price must equal5'; END IF;
 IF (SELECT sample_count FROM analytics_item_prices WHERE normalized_item_name='analytics') IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Unknown samples must be excluded'; END IF;
 IF (SELECT avg_price FROM analytics_price_trends WHERE normalized_item_name='analytics') IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'Price trends must exclude unknown data'; END IF;
END $$;
SELECT public.create_purchase_with_items(NULL,repeat('1',44),'2026-11-08',999,false,
 '[{"name":"Reimportado","quantity":3,"price":333,"line_total":999,"price_basis":"unit"}]'::jsonb);
DO $$ BEGIN
 IF (SELECT line_total FROM items WHERE name='Reimportado') IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Known receipt data must remain idempotent'; END IF;
END $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000002'::uuid $$;
SELECT public.create_purchase_with_items(NULL,repeat('1',44),'2026-11-08',999,false,
 '[{"name":"OutroUsuario","quantity":3,"price":333,"line_total":999,"price_basis":"unit"}]'::jsonb);
DO $$ BEGIN
 IF (SELECT count(*) FROM purchases WHERE access_key_hash IS NOT NULL) IS DISTINCT FROM 2::bigint THEN RAISE EXCEPTION 'Receipt hash identity must remain scoped to user'; END IF;
 IF (SELECT line_total FROM items WHERE name='Reimportado') IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'Other user must not change original receipt'; END IF;
END $$;

UPDATE items SET price_basis='unknown', line_total=NULL WHERE normalized_name='analytics';
SELECT public.run_analytics_aggregation('2026-11-08');
DO $$ BEGIN
 IF EXISTS(SELECT FROM analytics_item_prices WHERE normalized_item_name='analytics') OR EXISTS(SELECT FROM analytics_price_trends WHERE normalized_item_name='analytics') THEN RAISE EXCEPTION 'Recalculation must remove buckets below contributor threshold'; END IF;
END $$;
