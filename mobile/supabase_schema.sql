-- =============================================
-- Supabase Schema for MeuGasto
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id)
);

-- =============================================
-- SUPERMARKETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS supermarkets (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cnpj TEXT,
  city TEXT,
  state TEXT,
  manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PURCHASES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supermarket_id INTEGER REFERENCES supermarkets(id) ON DELETE SET NULL,
  access_key TEXT,
  date DATE NOT NULL,
  total_price DECIMAL(10,2) DEFAULT 0,
  manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- DRAFTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  supermarket_id INTEGER REFERENCES supermarkets(id) ON DELETE SET NULL,
  content TEXT,
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- SUPERMARKETS POLICIES
-- =============================================
CREATE POLICY "Users can view supermarkets" ON supermarkets
  FOR SELECT USING (
    user_id = auth.uid() OR user_id IS NULL
  );

CREATE POLICY "Users can insert supermarkets" ON supermarkets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supermarkets" ON supermarkets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supermarkets" ON supermarkets
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- PURCHASES POLICIES
-- =============================================
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchases" ON purchases
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchases" ON purchases
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- ITEMS POLICIES
-- =============================================
CREATE POLICY "Users can view items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = items.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items" ON items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = items.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items" ON items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = items.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items" ON items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = items.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

-- =============================================
-- DRAFTS POLICIES
-- =============================================
CREATE POLICY "Users can view own drafts" ON drafts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts" ON drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts" ON drafts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts" ON drafts
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_supermarket_id ON purchases(supermarket_id);

CREATE INDEX IF NOT EXISTS idx_items_purchase_id ON items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_items_purchase_id_name ON items(purchase_id, name);

CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_supermarket_id ON drafts(supermarket_id);

CREATE INDEX IF NOT EXISTS idx_supermarkets_user_id ON supermarkets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_access_key_unique
  ON purchases(user_id, access_key)
  WHERE access_key IS NOT NULL;

-- =============================================
-- TRANSACTIONAL PURCHASE CREATION
-- =============================================
CREATE OR REPLACE FUNCTION public.create_purchase_with_items(
  p_user_id UUID,
  p_supermarket_id INTEGER,
  p_access_key TEXT,
  p_date DATE,
  p_total_price NUMERIC,
  p_manual BOOLEAN,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(purchase_id INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_purchase_id INTEGER;
BEGIN
  IF p_access_key IS NOT NULL THEN
    SELECT id
      INTO v_purchase_id
      FROM purchases
     WHERE user_id = p_user_id
       AND access_key = p_access_key
     LIMIT 1;

    IF v_purchase_id IS NOT NULL THEN
      RETURN QUERY SELECT v_purchase_id;
      RETURN;
    END IF;
  END IF;

  BEGIN
    INSERT INTO purchases (
      user_id,
      supermarket_id,
      access_key,
      date,
      total_price,
      manual
    )
    VALUES (
      p_user_id,
      p_supermarket_id,
      p_access_key,
      p_date,
      p_total_price,
      p_manual
    )
    RETURNING id INTO v_purchase_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id
        INTO v_purchase_id
        FROM purchases
       WHERE user_id = p_user_id
         AND access_key = p_access_key
       LIMIT 1;
  END;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO items (
      purchase_id,
      name,
      code,
      quantity,
      unit,
      price
    )
    SELECT
      v_purchase_id,
      item.name,
      NULLIF(item.code, ''),
      COALESCE(item.quantity, 1),
      NULLIF(item.unit, ''),
      COALESCE(item.price, 0)
    FROM jsonb_to_recordset(p_items) AS item(
      name TEXT,
      code TEXT,
      quantity NUMERIC,
      unit TEXT,
      price NUMERIC
    );
  END IF;

  RETURN QUERY SELECT v_purchase_id;
END;
$$;

-- =============================================
-- REPORTING HELPERS
-- =============================================
CREATE OR REPLACE FUNCTION public.report_expenses_by_supermarket(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(supermarket TEXT, total NUMERIC)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    COALESCE(s.name, 'Sem supermercado') AS supermarket,
    COALESCE(SUM(p.total_price), 0) AS total
  FROM purchases p
  LEFT JOIN supermarkets s ON s.id = p.supermarket_id
  WHERE p.user_id = p_user_id
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(s.name, 'Sem supermercado')
  ORDER BY total DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_top_items(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(name TEXT, quantity NUMERIC, total NUMERIC)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    COALESCE(i.name, 'Sem nome') AS name,
    COALESCE(SUM(i.quantity), 0) AS quantity,
    COALESCE(SUM(i.quantity * i.price), 0) AS total
  FROM items i
  INNER JOIN purchases p ON p.id = i.purchase_id
  WHERE p.user_id = p_user_id
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(i.name, 'Sem nome')
  ORDER BY total DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
