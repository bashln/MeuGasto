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

CREATE TABLE public.supermarkets(id integer, name text);

CREATE TABLE IF NOT EXISTS "public"."analytics_item_prices" (
    "id" bigserial NOT NULL,
    "bucket_date" "date" NOT NULL,
    "city" "text",
    "state" "text",
    "supermarket_id" integer,
    "normalized_item_name" "text" NOT NULL,
    "unit" "text",
    "avg_unit_price" numeric(10,4) NOT NULL,
    "min_unit_price" numeric(10,4) NOT NULL,
    "max_unit_price" numeric(10,4) NOT NULL,
    "sample_count" integer NOT NULL,
    "contributor_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_item_prices_contributor_min" CHECK (("contributor_count" >= 5)),
    CONSTRAINT "analytics_item_prices_sample_min" CHECK (("sample_count" >= 1))
);
CREATE UNIQUE INDEX "idx_analytics_item_prices_bucket" ON "public"."analytics_item_prices" USING "btree" ("bucket_date", "normalized_item_name", COALESCE("supermarket_id", 0), COALESCE("city", ''::"text"), COALESCE("unit", ''::"text"));

CREATE TABLE IF NOT EXISTS "public"."analytics_market_baskets" (
    "id" bigserial NOT NULL,
    "bucket_date" "date" NOT NULL,
    "city" "text",
    "state" "text",
    "supermarket_id" integer,
    "basket_key" "text" NOT NULL,
    "avg_basket_price" numeric(10,2) NOT NULL,
    "min_basket_price" numeric(10,2) NOT NULL,
    "max_basket_price" numeric(10,2) NOT NULL,
    "sample_count" integer NOT NULL,
    "contributor_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_market_baskets_contributor_min" CHECK (("contributor_count" >= 5))
);
CREATE UNIQUE INDEX "idx_analytics_market_baskets_bucket" ON "public"."analytics_market_baskets" USING "btree" ("bucket_date", "basket_key", COALESCE("supermarket_id", 0), COALESCE("city", ''::"text"));

CREATE TABLE IF NOT EXISTS "public"."analytics_price_trends" (
    "id" bigserial NOT NULL,
    "bucket_month" "date" NOT NULL,
    "city" "text",
    "state" "text",
    "normalized_item_name" "text" NOT NULL,
    "avg_price" numeric(10,4) NOT NULL,
    "price_change_percent" numeric(8,4),
    "sample_count" integer NOT NULL,
    "contributor_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_price_trends_contributor_min" CHECK (("contributor_count" >= 5))
);
CREATE UNIQUE INDEX "idx_analytics_price_trends_bucket" ON "public"."analytics_price_trends" USING "btree" ("bucket_month", "normalized_item_name", COALESCE("city", ''::"text"));

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
