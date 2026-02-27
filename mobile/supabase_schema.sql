-- =============================================
-- Supabase Schema for Mercado App
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

CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_supermarket_id ON drafts(supermarket_id);

CREATE INDEX IF NOT EXISTS idx_supermarkets_user_id ON supermarkets(user_id);
