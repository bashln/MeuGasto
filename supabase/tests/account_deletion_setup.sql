\set ON_ERROR_STOP on
-- Fixture mínima para exercitar a exclusão de conta sem Supabase real.
-- Cobre auth.uid(), FKs em cascata e a chamada de recomputação analítica.

CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.supermarkets (
  id serial PRIMARY KEY,
  user_id uuid,
  name text
);

CREATE TABLE public.purchases (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  supermarket_id integer,
  date date NOT NULL,
  total_price numeric
);

CREATE TABLE public.items (
  id serial PRIMARY KEY,
  purchase_id integer REFERENCES public.purchases(id) ON DELETE CASCADE,
  name text
);

CREATE TABLE public.drafts (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.shopping_lists (
  id serial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.analytics_runs (
  bucket_date date NOT NULL
);

CREATE FUNCTION public.run_analytics_aggregation(p_bucket_date date DEFAULT CURRENT_DATE - 1)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.analytics_runs(bucket_date) VALUES (p_bucket_date);
END;
$$;

INSERT INTO auth.users(id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

INSERT INTO public.profiles(id) VALUES
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

INSERT INTO public.purchases(id, user_id, date, total_price) VALUES
  (1, '00000000-0000-0000-0000-00000000000a', '2026-10-01', 100),
  (2, '00000000-0000-0000-0000-00000000000a', '2026-10-02', 50),
  (3, '00000000-0000-0000-0000-00000000000b', '2026-10-03', 30);

INSERT INTO public.items(purchase_id, name) VALUES
  (1, 'Arroz'),
  (2, 'Leite'),
  (3, 'Café');

INSERT INTO public.drafts(user_id) VALUES
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');

INSERT INTO public.shopping_lists(user_id) VALUES
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b');
