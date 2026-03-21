-- =============================================
-- MeuGasto - Security hardening migration
-- Date: 2026-03-21
-- Apply in Supabase SQL Editor when the local schema file
-- has changed but the remote project has not yet been updated.
-- =============================================

UPDATE drafts
   SET content = public.normalize_draft_content(content)
 WHERE content IS NOT NULL;

ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_content_canonical_check;
ALTER TABLE drafts ADD CONSTRAINT drafts_content_canonical_check
  CHECK (public.is_valid_draft_content(content));

CREATE OR REPLACE FUNCTION public.assert_supermarket_access(
  p_supermarket_id INTEGER,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_supermarket_id IS NULL THEN
    RETURN;
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.supermarkets s
     WHERE s.id = p_supermarket_id
       AND (s.user_id = p_user_id OR s.user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Supermercado fora do escopo do usuario';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_and_validate_draft_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.content := public.normalize_draft_content(NEW.content);
  PERFORM public.assert_supermarket_access(NEW.supermarket_id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_and_validate_drafts ON drafts;
CREATE TRIGGER normalize_and_validate_drafts
  BEFORE INSERT OR UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION public.normalize_and_validate_draft_row();

CREATE OR REPLACE FUNCTION public.validate_purchase_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_items_count INTEGER := 0;
  v_existing_items_total NUMERIC := 0;
BEGIN
  PERFORM public.assert_supermarket_access(NEW.supermarket_id, NEW.user_id);

  IF NEW.manual IS TRUE AND NEW.access_key IS NOT NULL THEN
    RAISE EXCEPTION 'Compras manuais nao podem definir access_key';
  END IF;

  IF NEW.manual IS FALSE AND (NEW.access_key IS NULL OR NEW.access_key !~ '^\d{44}$') THEN
    RAISE EXCEPTION 'Compras importadas exigem access_key valida';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COUNT(*), COALESCE(SUM(i.quantity * i.price), 0)
      INTO v_existing_items_count, v_existing_items_total
      FROM public.items i
     WHERE i.purchase_id = OLD.id;

    IF v_existing_items_count > 0 AND ABS(ROUND(COALESCE(NEW.total_price, 0), 2) - ROUND(v_existing_items_total, 2)) > 0.01 THEN
      RAISE EXCEPTION 'total_price deve corresponder a soma dos itens';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_purchase_integrity ON purchases;
CREATE TRIGGER validate_purchase_integrity
  BEFORE INSERT OR UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.validate_purchase_row();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE supermarkets ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role is immutable';
  END IF;

  NEW.id := OLD.id;
  NEW.role := OLD.role;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_immutable_fields ON profiles;
CREATE TRIGGER protect_profile_immutable_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

DROP POLICY IF EXISTS "Users can view supermarkets" ON supermarkets;
CREATE POLICY "Users can view supermarkets" ON supermarkets
  FOR SELECT USING (
    user_id = auth.uid() OR user_id IS NULL
  );

DROP POLICY IF EXISTS "Users can insert supermarkets" ON supermarkets;
CREATE POLICY "Users can insert supermarkets" ON supermarkets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own supermarkets" ON supermarkets;
CREATE POLICY "Users can update own supermarkets" ON supermarkets
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own supermarkets" ON supermarkets;
CREATE POLICY "Users can delete own supermarkets" ON supermarkets
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own purchases" ON purchases;
CREATE POLICY "Users can view own purchases" ON purchases
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can update own purchases" ON purchases;
CREATE POLICY "Users can update own purchases" ON purchases
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own purchases" ON purchases;
CREATE POLICY "Users can delete own purchases" ON purchases
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view items" ON items;
CREATE POLICY "Users can view items" ON items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases
      WHERE purchases.id = items.purchase_id
      AND purchases.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert items" ON items;
DROP POLICY IF EXISTS "Users can update items" ON items;
DROP POLICY IF EXISTS "Users can delete items" ON items;

DROP POLICY IF EXISTS "Users can view own drafts" ON drafts;
CREATE POLICY "Users can view own drafts" ON drafts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own drafts" ON drafts;
CREATE POLICY "Users can insert own drafts" ON drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own drafts" ON drafts;
CREATE POLICY "Users can update own drafts" ON drafts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own drafts" ON drafts;
CREATE POLICY "Users can delete own drafts" ON drafts
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.prevent_imported_purchase_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.manual = false THEN
    RAISE EXCEPTION 'Compras importadas via NFC-e não podem ser alteradas';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_imported_purchases ON purchases;
CREATE TRIGGER protect_imported_purchases
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.prevent_imported_purchase_updates();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO UPDATE
    SET name = COALESCE(public.profiles.name, EXCLUDED.name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
SECURITY DEFINER
SET search_path = public
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
  v_quantity NUMERIC;
  v_price NUMERIC;
  v_line_total NUMERIC;
  v_computed_total NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  PERFORM public.assert_supermarket_access(p_supermarket_id, v_user_id);

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

  IF p_manual AND p_access_key IS NOT NULL THEN
    RAISE EXCEPTION 'Compras manuais nao podem definir access_key';
  END IF;

  IF NOT p_manual AND p_access_key IS NULL THEN
    RAISE EXCEPTION 'Compras importadas exigem access_key valida';
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

  IF NOT p_manual AND v_item_count = 0 THEN
    RAISE EXCEPTION 'Compras importadas exigem ao menos um item';
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

    v_computed_total := v_computed_total + v_line_total;
  END LOOP;

  v_computed_total := ROUND(v_computed_total, 2);

  IF v_item_count > 0 AND ABS(ROUND(p_total_price, 2) - v_computed_total) > 0.01 THEN
    RAISE EXCEPTION 'total_price deve corresponder a soma dos itens';
  END IF;

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
      CASE WHEN v_item_count > 0 THEN v_computed_total ELSE p_total_price END,
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
      INSERT INTO items (
        purchase_id,
        name,
        code,
        quantity,
        unit,
        price
      )
      VALUES (
        v_purchase_id,
        btrim(v_item->>'name'),
        NULLIF(btrim(COALESCE(v_item->>'code', '')), ''),
        COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1),
        NULLIF(btrim(COALESCE(v_item->>'unit', '')), ''),
        COALESCE(NULLIF(v_item->>'price', '')::NUMERIC, 0)
      );
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_draft_to_purchase(
  p_draft_id INTEGER,
  p_purchase_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(purchase_id INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_draft drafts%ROWTYPE;
  v_normalized_content TEXT;
  v_content_json JSONB;
  v_purchase_id INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  SELECT *
    INTO v_draft
    FROM public.drafts
   WHERE id = p_draft_id
     AND user_id = v_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rascunho não encontrado';
  END IF;

  v_normalized_content := public.normalize_draft_content(v_draft.content);
  IF NOT public.is_valid_draft_content(v_normalized_content) THEN
    RAISE EXCEPTION 'Conteúdo do rascunho inválido';
  END IF;

  v_content_json := COALESCE(v_normalized_content::JSONB, '{"version":1,"notes":"","items":[]}'::JSONB);

  SELECT created.purchase_id
    INTO v_purchase_id
    FROM public.create_purchase_with_items(
      v_draft.supermarket_id,
      NULL,
      COALESCE(p_purchase_date, CURRENT_DATE),
      COALESCE(v_draft.total_price, 0),
      TRUE,
      COALESCE(v_content_json->'items', '[]'::JSONB)
    ) AS created;

  IF v_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível converter o rascunho em compra';
  END IF;

  DELETE FROM public.drafts
   WHERE id = v_draft.id
     AND user_id = v_user_id;

  RETURN QUERY SELECT v_purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_supermarket_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'supermarkets.user_id is immutable';
  END IF;

  IF NEW.manual IS DISTINCT FROM OLD.manual THEN
    RAISE EXCEPTION 'supermarkets.manual is immutable';
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.manual := OLD.manual;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.protect_purchase_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'purchases.user_id is immutable';
  END IF;

  IF NEW.manual IS DISTINCT FROM OLD.manual THEN
    RAISE EXCEPTION 'purchases.manual is immutable';
  END IF;

  IF NEW.access_key IS DISTINCT FROM OLD.access_key THEN
    RAISE EXCEPTION 'purchases.access_key is immutable';
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.manual := OLD.manual;
  NEW.access_key := OLD.access_key;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.protect_draft_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'drafts.user_id is immutable';
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_supermarket_immutable_fields ON supermarkets;
CREATE TRIGGER protect_supermarket_immutable_fields
  BEFORE UPDATE ON supermarkets
  FOR EACH ROW EXECUTE FUNCTION public.protect_supermarket_immutable_fields();

DROP TRIGGER IF EXISTS protect_purchase_immutable_fields ON purchases;
CREATE TRIGGER protect_purchase_immutable_fields
  BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchase_immutable_fields();

DROP TRIGGER IF EXISTS protect_draft_immutable_fields ON drafts;
CREATE TRIGGER protect_draft_immutable_fields
  BEFORE UPDATE ON drafts
  FOR EACH ROW EXECUTE FUNCTION public.protect_draft_immutable_fields();
