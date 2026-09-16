-- =============================================
-- Price Comparison Persistence Migration
-- Tables: sessions, quotes, quote_items
-- TTL: 30 days (expires_at)
-- =============================================

-- =============================================
-- PRICE COMPARISON SESSIONS
-- Agrupa uma cesta de itens comparada entre mercados
-- =============================================
CREATE TABLE IF NOT EXISTS price_comparison_sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  source_shopping_list_id INTEGER REFERENCES shopping_lists(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- PRICE COMPARISON QUOTES
-- Snapshots de preço de um mercado para uma sessão
-- =============================================
CREATE TABLE IF NOT EXISTS price_comparison_quotes (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES price_comparison_sessions(id) ON DELETE CASCADE,
  supermarket_id INTEGER REFERENCES supermarkets(id) ON DELETE SET NULL,
  market_name_snapshot TEXT NOT NULL,
  notes TEXT,
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- PRICE COMPARISON QUOTE ITEMS
-- Itens individuais de cada cotação
-- =============================================
CREATE TABLE IF NOT EXISTS price_comparison_quote_items (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES price_comparison_quotes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit TEXT DEFAULT 'UN',
  price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_pcs_user_id ON price_comparison_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pcs_expires_at ON price_comparison_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_pcq_session_id ON price_comparison_quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_pcqi_quote_id ON price_comparison_quote_items(quote_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE price_comparison_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_comparison_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_comparison_quote_items ENABLE ROW LEVEL SECURITY;

-- Sessions: user owns directly
CREATE POLICY "Users can view own comparison sessions" ON price_comparison_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own comparison sessions" ON price_comparison_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comparison sessions" ON price_comparison_sessions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comparison sessions" ON price_comparison_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Quotes: inherit via session
CREATE POLICY "Users can view own comparison quotes" ON price_comparison_quotes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM price_comparison_sessions
      WHERE price_comparison_sessions.id = price_comparison_quotes.session_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comparison quotes" ON price_comparison_quotes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM price_comparison_sessions
      WHERE price_comparison_sessions.id = price_comparison_quotes.session_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update comparison quotes" ON price_comparison_quotes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM price_comparison_sessions
      WHERE price_comparison_sessions.id = price_comparison_quotes.session_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete comparison quotes" ON price_comparison_quotes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM price_comparison_sessions
      WHERE price_comparison_sessions.id = price_comparison_quotes.session_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

-- Quote items: inherit via quote -> session
CREATE POLICY "Users can view own comparison quote items" ON price_comparison_quote_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM price_comparison_quotes
      JOIN price_comparison_sessions ON price_comparison_sessions.id = price_comparison_quotes.session_id
      WHERE price_comparison_quotes.id = price_comparison_quote_items.quote_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert comparison quote items" ON price_comparison_quote_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM price_comparison_quotes
      JOIN price_comparison_sessions ON price_comparison_sessions.id = price_comparison_quotes.session_id
      WHERE price_comparison_quotes.id = price_comparison_quote_items.quote_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update comparison quote items" ON price_comparison_quote_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM price_comparison_quotes
      JOIN price_comparison_sessions ON price_comparison_sessions.id = price_comparison_quotes.session_id
      WHERE price_comparison_quotes.id = price_comparison_quote_items.quote_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete comparison quote items" ON price_comparison_quote_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM price_comparison_quotes
      JOIN price_comparison_sessions ON price_comparison_sessions.id = price_comparison_quotes.session_id
      WHERE price_comparison_quotes.id = price_comparison_quote_items.quote_id
      AND price_comparison_sessions.user_id = auth.uid()
    )
  );

-- Dedicated trigger for updated_at. Keeping it in this migration makes the
-- price-comparison schema independently reproducible on a fresh database.
CREATE OR REPLACE FUNCTION public.set_price_comparison_session_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_price_comparison_session_updated_at()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS set_updated_at_price_comparison_sessions ON price_comparison_sessions;
CREATE TRIGGER set_updated_at_price_comparison_sessions
  BEFORE UPDATE ON price_comparison_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_price_comparison_session_updated_at();
