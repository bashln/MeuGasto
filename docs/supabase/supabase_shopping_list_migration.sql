-- Enable trigram extension for optimized partial string indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================
-- SHOPPING LISTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS shopping_lists (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SHOPPING LIST ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id SERIAL PRIMARY KEY,
  shopping_list_id INTEGER REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1 CHECK (quantity > 0),
  unit TEXT DEFAULT 'UN',
  estimated_price DECIMAL(10,2) DEFAULT 0 CHECK (estimated_price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Políticas para shopping_lists
CREATE POLICY "Users can view own shopping lists" ON shopping_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shopping lists" ON shopping_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shopping lists" ON shopping_lists
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shopping lists" ON shopping_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para shopping_list_items
CREATE POLICY "Users can view own shopping list items" ON shopping_list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
      AND shopping_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own shopping list items" ON shopping_list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
      AND shopping_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own shopping list items" ON shopping_list_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
      AND shopping_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
      AND shopping_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own shopping list items" ON shopping_list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
      AND shopping_lists.user_id = auth.uid()
    )
  );

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_id ON shopping_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id ON shopping_list_items(shopping_list_id);

-- GIN Trigram Index on items(name) for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING gin (name gin_trgm_ops);

-- =============================================
-- FUNCTION: get_item_average_price
-- =============================================

CREATE OR REPLACE FUNCTION public.get_item_average_price(p_item_name TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_avg_price NUMERIC;
  v_normalized_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF p_item_name IS NULL OR btrim(p_item_name) = '' THEN
    RETURN 0.00;
  END IF;

  v_normalized_name := public.normalize_item_name(p_item_name);

  -- Match using normalized_name for abbreviation-aware lookup
  SELECT 
    CASE 
      WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(i.price * i.quantity) / SUM(i.quantity), 2)
      ELSE 0.00
    END
  INTO v_avg_price
  FROM items i
  INNER JOIN purchases p ON p.id = i.purchase_id
  WHERE p.user_id = v_user_id
    AND (
      i.normalized_name ILIKE v_normalized_name || '%' 
      OR i.normalized_name ILIKE '% ' || v_normalized_name || '%'
      OR i.name ILIKE btrim(p_item_name) || '%' 
      OR i.name ILIKE '% ' || btrim(p_item_name) || '%'
    );

  RETURN COALESCE(v_avg_price, 0.00);
END;
$$;

-- =============================================
-- FUNCTION: get_items_average_prices_bulk
-- =============================================
CREATE OR REPLACE FUNCTION public.get_items_average_prices_bulk(p_item_names TEXT[])
RETURNS TABLE(item_name TEXT, avg_price NUMERIC)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  RETURN QUERY
  SELECT 
    name_param AS item_name,
    COALESCE(
      (
        SELECT CASE 
          WHEN name_param IS NULL OR btrim(name_param) = '' THEN 0.00
          WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(i.price * i.quantity) / SUM(i.quantity), 2)
          ELSE 0.00
        END
        FROM items i
        INNER JOIN purchases p ON p.id = i.purchase_id
        WHERE p.user_id = v_user_id
          AND name_param IS NOT NULL AND btrim(name_param) <> ''
          AND (
            i.normalized_name ILIKE public.normalize_item_name(name_param) || '%' 
            OR i.normalized_name ILIKE '% ' || public.normalize_item_name(name_param) || '%'
            OR i.name ILIKE btrim(name_param) || '%' 
            OR i.name ILIKE '% ' || btrim(name_param) || '%'
          )
      ), 
      0.00
    ) AS avg_price
  FROM unnest(p_item_names) AS name_param;
END;
$$;
