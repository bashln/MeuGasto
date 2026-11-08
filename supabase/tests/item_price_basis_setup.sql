\set ON_ERROR_STOP on
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.normalize_item_name(text) RETURNS text LANGUAGE sql AS $$ SELECT lower($1) $$;
CREATE FUNCTION public.digest(text,text) RETURNS bytea LANGUAGE sql AS $$ SELECT sha256(convert_to($1, 'UTF8')) $$;
CREATE TABLE public.purchases (
 id serial PRIMARY KEY, user_id uuid, supermarket_id integer, access_key_hash text, date date,
 total_price numeric, manual boolean
);
CREATE TABLE public.items (
 id serial PRIMARY KEY, purchase_id integer, name text, normalized_name text, code text,
 category_id integer, quantity numeric, unit text, price numeric
);
INSERT INTO purchases(user_id,date,total_price) VALUES (auth.uid(),'2026-11-08',10);
INSERT INTO items(purchase_id,name,normalized_name,quantity,unit,price)
 VALUES (1,'Leite','leite',2,'UN',10);

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


INSERT INTO analytics_item_prices(bucket_date,normalized_item_name,avg_unit_price,min_unit_price,max_unit_price,sample_count,contributor_count) VALUES ('2020-01-01','stale',999,999,999,5,5);
INSERT INTO analytics_price_trends(bucket_month,normalized_item_name,avg_price,sample_count,contributor_count) VALUES ('2020-01-01','stale',999,5,5);
