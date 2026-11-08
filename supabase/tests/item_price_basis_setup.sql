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
