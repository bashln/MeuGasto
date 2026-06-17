-- =============================================
-- Supabase Schema for MeuGasto
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================
-- NAME NORMALIZATION FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION public.normalize_item_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result TEXT;
  v_abbreviations JSONB := '{
    "det": "detergente",
    "pao": "pao",
    "refri": "refrigerante",
    "refrig": "refrigerante",
    "lavat": "sabao",
    "cond": "condensado",
    "desc": "descartavel",
    "shamp": "shampoo",
    "sab": "sabonete",
    "crem": "creme",
    "pct": "pacote",
    "un": "unidade",
    "kg": "quilo",
    "g": "grama",
    "ml": "mililitro",
    "l": "litro",
    "ipe": "ipe",
    "tb": "tirol",
    "pr": "prata"
  }';
  v_word TEXT;
  v_words TEXT[];
  v_normalized_words TEXT[];
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RETURN '';
  END IF;

  -- Lowercase and remove accents
  v_result := LOWER(unaccent(btrim(p_name)));
  -- Remove special characters
  v_result := REGEXP_REPLACE(v_result, '[^a-z0-9\s]', '', 'g');
  -- Collapse whitespace
  v_result := REGEXP_REPLACE(v_result, '\s+', ' ', 'g');
  v_result := TRIM(v_result);

  -- Expand abbreviations
  v_words := string_to_array(v_result, ' ');
  v_normalized_words := ARRAY[]::TEXT[];
  FOREACH v_word IN ARRAY v_words LOOP
    IF v_word = '' THEN CONTINUE; END IF;
    IF v_abbreviations ? v_word THEN
      v_normalized_words := array_append(v_normalized_words, v_abbreviations->>v_word);
    ELSE
      v_normalized_words := array_append(v_normalized_words, v_word);
    END IF;
  END LOOP;

  RETURN array_to_string(v_normalized_words, ' ');
END;
$$;

-- =============================================
-- TRIGGERS FOR NORMALIZED_NAME
-- =============================================
CREATE OR REPLACE FUNCTION public.set_normalized_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name := public.normalize_item_name(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_name_length_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_name_length_check
  CHECK (name IS NULL OR (char_length(btrim(name)) >= 1 AND char_length(name) <= 100));

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

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_access_key_format_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_access_key_format_check
  CHECK (access_key IS NULL OR access_key ~ '^\d{44}$');

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_total_price_range_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_total_price_range_check
  CHECK (total_price >= 0 AND total_price <= 99999999.99);

-- =============================================
-- ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  category_id INTEGER,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  normalized_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS category_id INTEGER;

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_name_length_check;
ALTER TABLE items ADD CONSTRAINT items_name_length_check
  CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 200);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_code_length_check;
ALTER TABLE items ADD CONSTRAINT items_code_length_check
  CHECK (code IS NULL OR char_length(code) <= 80);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_unit_length_check;
ALTER TABLE items ADD CONSTRAINT items_unit_length_check
  CHECK (unit IS NULL OR char_length(unit) <= 16);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_quantity_range_check;
ALTER TABLE items ADD CONSTRAINT items_quantity_range_check
  CHECK (quantity > 0 AND quantity <= 99999);

ALTER TABLE items DROP CONSTRAINT IF EXISTS items_price_range_check;
ALTER TABLE items ADD CONSTRAINT items_price_range_check
  CHECK (price >= 0 AND price <= 99999999.99);

-- Trigger for normalized_name on items
DROP TRIGGER IF EXISTS items_set_normalized_name ON items;
CREATE TRIGGER items_set_normalized_name
  BEFORE INSERT OR UPDATE OF name ON items
  FOR EACH ROW EXECUTE FUNCTION public.set_normalized_name();

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

ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_content_length_check;
ALTER TABLE drafts ADD CONSTRAINT drafts_content_length_check
  CHECK (content IS NULL OR char_length(content) <= 50000);

-- =============================================
-- LEARNED RECLASSIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS learned_reclassifications (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  normalized_name TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learned_reclassifications DROP CONSTRAINT IF EXISTS learned_reclassifications_name_length_check;
ALTER TABLE learned_reclassifications ADD CONSTRAINT learned_reclassifications_name_length_check
  CHECK (char_length(btrim(normalized_name)) > 0 AND char_length(normalized_name) <= 200);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_reclassifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Prevent users from escalating their own role or altering immutable fields
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.role := OLD.role;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_immutable_fields ON profiles;
CREATE TRIGGER protect_profile_immutable_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

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
-- LEARNED RECLASSIFICATIONS POLICIES
-- =============================================
CREATE POLICY "Users can view own reclassifications" ON learned_reclassifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reclassifications" ON learned_reclassifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reclassifications" ON learned_reclassifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reclassifications" ON learned_reclassifications
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
CREATE INDEX IF NOT EXISTS idx_learned_reclassifications_user_id ON learned_reclassifications(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_reclassifications_user_name_unique
  ON learned_reclassifications(user_id, normalized_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_access_key_unique
  ON purchases(user_id, access_key)
  WHERE access_key IS NOT NULL;

-- =============================================
-- TRANSACTIONAL PURCHASE CREATION
-- =============================================
CREATE OR REPLACE FUNCTION public.create_purchase_with_items(
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
  v_user_id UUID := auth.uid();
  v_purchase_id INTEGER;
  v_max_items INTEGER := 300;
  v_max_text_length INTEGER := 200;
  v_max_code_length INTEGER := 80;
  v_max_unit_length INTEGER := 16;
  v_item JSONB;
  v_item_count INTEGER;
  v_name TEXT;
  v_code TEXT;
  v_unit TEXT;
  v_category_id INTEGER;
  v_quantity NUMERIC;
  v_price NUMERIC;
  v_line_total NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF p_total_price IS NULL OR p_total_price < 0 OR p_total_price > 99999999.99 THEN
    RAISE EXCEPTION 'total_price fora do intervalo permitido';
  END IF;

  IF p_access_key IS NOT NULL THEN
    p_access_key := btrim(p_access_key);
    IF p_access_key = '' THEN
      p_access_key := NULL;
    ELSIF p_access_key !~ '^\d{44}$' THEN
      RAISE EXCEPTION 'access_key invalida: deve conter 44 digitos';
    END IF;
  END IF;

  IF p_items IS NULL THEN
    p_items := '[]'::JSONB;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items deve ser um array JSON';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count > v_max_items THEN
    RAISE EXCEPTION 'limite de % itens por compra excedido', v_max_items;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_name := btrim(COALESCE(v_item->>'name', ''));
    v_code := NULLIF(btrim(COALESCE(v_item->>'code', '')), '');
    v_unit := NULLIF(btrim(COALESCE(v_item->>'unit', '')), '');

    IF char_length(v_name) = 0 OR char_length(v_name) > v_max_text_length THEN
      RAISE EXCEPTION 'item.name invalido: tamanho maximo de % caracteres', v_max_text_length;
    END IF;

    IF v_code IS NOT NULL AND char_length(v_code) > v_max_code_length THEN
      RAISE EXCEPTION 'item.code invalido: tamanho maximo de % caracteres', v_max_code_length;
    END IF;

    IF v_unit IS NOT NULL AND char_length(v_unit) > v_max_unit_length THEN
      RAISE EXCEPTION 'item.unit invalido: tamanho maximo de % caracteres', v_max_unit_length;
    END IF;

    BEGIN
      v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1);
      v_price := COALESCE(NULLIF(v_item->>'price', '')::NUMERIC, 0);
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'item.quantity/item.price contem valor nao numerico';
    END;

    IF v_quantity <= 0 OR v_quantity > 99999 THEN
      RAISE EXCEPTION 'item.quantity fora do intervalo permitido';
    END IF;

    IF v_price < 0 OR v_price > 99999999.99 THEN
      RAISE EXCEPTION 'item.price fora do intervalo permitido';
    END IF;

    v_line_total := ROUND(v_quantity * v_price, 2);
    IF v_line_total < 0 OR v_line_total > 99999999.99 THEN
      RAISE EXCEPTION 'item.total_price fora do intervalo permitido';
    END IF;
  END LOOP;

  IF p_access_key IS NOT NULL THEN
    SELECT id
      INTO v_purchase_id
      FROM purchases
     WHERE user_id = v_user_id
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
      v_user_id,
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
       WHERE user_id = v_user_id
         AND access_key = p_access_key
       LIMIT 1;
  END;

  IF v_item_count > 0 THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      BEGIN
        v_category_id := NULLIF(v_item->>'category_id', '')::INTEGER;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_category_id := NULL;
      END;

      INSERT INTO items (
        purchase_id,
        name,
        code,
        category_id,
        quantity,
        unit,
        price
      )
      VALUES (
        v_purchase_id,
        btrim(v_item->>'name'),
        NULLIF(btrim(COALESCE(v_item->>'code', '')), ''),
        v_category_id,
        COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1),
        NULLIF(btrim(COALESCE(v_item->>'unit', '')), ''),
        COALESCE(NULLIF(v_item->>'price', '')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_purchase_id;
END;
$$;

-- =============================================
-- REPORTING HELPERS
-- =============================================
CREATE OR REPLACE FUNCTION public.report_expenses_by_supermarket(
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
  WHERE p.user_id = auth.uid()
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(s.name, 'Sem supermercado')
  ORDER BY total DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_top_items(
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
  WHERE p.user_id = auth.uid()
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(i.name, 'Sem nome')
  ORDER BY total DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;

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
  normalized_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for normalized_name on shopping_list_items
DROP TRIGGER IF EXISTS shopping_list_items_set_normalized_name ON shopping_list_items;
CREATE TRIGGER shopping_list_items_set_normalized_name
  BEFORE INSERT OR UPDATE OF name ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.set_normalized_name();

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

-- Constraint: apenas uma lista ativa por usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_one_active_per_user
  ON shopping_lists(user_id)
  WHERE status = 'active';

-- GIN Trigram Index on items(name) for fast ILIKE searches
CREATE INDEX IF NOT EXISTS idx_items_name_trgm ON items USING gin (name gin_trgm_ops);

-- Index on normalized_name for abbreviation-aware price lookups
CREATE INDEX IF NOT EXISTS idx_items_normalized_name ON items(normalized_name);

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
  v_normalized_name TEXT;
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
