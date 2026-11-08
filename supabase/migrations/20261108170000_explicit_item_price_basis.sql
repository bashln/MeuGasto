ALTER TABLE public.items ADD COLUMN price_basis text NOT NULL DEFAULT 'unknown' CHECK (price_basis IN ('unknown', 'unit')),
 ADD COLUMN line_total numeric(12,2) CHECK (line_total >= 0 AND line_total <= 99999999.99);

ALTER TABLE public.items ADD CONSTRAINT items_known_price_bounds_check
 CHECK (price_basis <> 'unit' OR (quantity > 0 AND quantity <= 99999
   AND price >= 0 AND price <= 99999999.99
   AND COALESCE(line_total, price * quantity) <= 99999999.99)) NOT VALID;


CREATE OR REPLACE FUNCTION public.normalize_item_price_basis() RETURNS trigger
LANGUAGE plpgsql SET search_path TO pg_catalog, public AS $$
BEGIN
  IF NEW.price_basis = 'line_total' THEN
    NEW.line_total := NEW.price;
    NEW.price := ROUND(NEW.price / NEW.quantity, 2);
    NEW.price_basis := 'unit';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER normalize_item_price_basis BEFORE INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.normalize_item_price_basis();

CREATE OR REPLACE FUNCTION "public"."create_purchase_with_items"("p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb" DEFAULT '[]'::"jsonb") RETURNS TABLE("purchase_id" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
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
  v_access_key_hash TEXT;
  v_hmac_secret TEXT;
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

  -- Computar HMAC da chave fiscal usando secret do Vault/configuração do servidor.
  -- Se secret não estiver configurado, usa SHA-256 simples (aceito como fallback inicial).
  IF p_access_key IS NOT NULL THEN
    BEGIN
      v_hmac_secret := current_setting('app.hmac_secret', true);
    EXCEPTION WHEN OTHERS THEN
      v_hmac_secret := NULL;
    END;

    IF v_hmac_secret IS NOT NULL AND v_hmac_secret <> '' THEN
      v_access_key_hash := encode(
        hmac(p_access_key, v_hmac_secret, 'sha256'),
        'hex'
      );
    ELSE
      -- Fallback: SHA-256 sem secret (menos seguro; migrar para HMAC quando secret estiver disponível)
      v_access_key_hash := encode(
        digest(p_access_key, 'sha256'),
        'hex'
      );
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

    v_line_total := COALESCE(NULLIF(v_item->>'line_total', '')::NUMERIC, ROUND(v_quantity * v_price, 2));
    IF v_line_total < 0 OR v_line_total > 99999999.99 THEN
      RAISE EXCEPTION 'item.total_price fora do intervalo permitido';
    END IF;
  END LOOP;

  -- Verificar duplicata pelo hash (nova lógica) ou access_key legado
  IF v_access_key_hash IS NOT NULL THEN
    SELECT id
      INTO v_purchase_id
      FROM purchases
     WHERE user_id = v_user_id
       AND access_key_hash = v_access_key_hash
     LIMIT 1 FOR UPDATE;
  END IF;

  IF v_purchase_id IS NULL THEN
  BEGIN
    INSERT INTO purchases (
      user_id,
      supermarket_id,
      access_key_hash,
      date,
      total_price,
      manual
    )
    VALUES (
      v_user_id,
      p_supermarket_id,
      v_access_key_hash,
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
         AND access_key_hash = v_access_key_hash
       LIMIT 1 FOR UPDATE;
  END;
  END IF;

  IF EXISTS (SELECT FROM items existing_item WHERE existing_item.purchase_id = v_purchase_id) THEN
    IF v_access_key_hash IS NULL OR v_item_count = 0
      OR NOT EXISTS (SELECT FROM items existing_item WHERE existing_item.purchase_id = v_purchase_id AND price_basis = 'unknown')
      OR EXISTS (SELECT FROM jsonb_array_elements(p_items) AS submitted
                 WHERE submitted->>'price_basis' IS DISTINCT FROM 'unit' OR submitted->>'line_total' IS NULL) THEN
      RETURN QUERY SELECT v_purchase_id;
      RETURN;
    END IF;
    DELETE FROM items existing_item WHERE existing_item.purchase_id = v_purchase_id;
  END IF;

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
        price,
        price_basis,
        line_total
      )
      VALUES (
        v_purchase_id,
        btrim(v_item->>'name'),
        NULLIF(btrim(COALESCE(v_item->>'code', '')), ''),
        v_category_id,
        COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1),
        NULLIF(btrim(COALESCE(v_item->>'unit', '')), ''),
        COALESCE(NULLIF(v_item->>'price', '')::NUMERIC, 0),
        CASE WHEN v_item->>'price_basis' IN ('unit', 'line_total') THEN v_item->>'price_basis' ELSE 'unknown' END,
        NULLIF(v_item->>'line_total', '')::NUMERIC
      );
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_purchase_id;
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."get_item_average_price"("p_item_name" "text") RETURNS numeric
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_avg_price NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF p_item_name IS NULL OR btrim(p_item_name) = '' THEN
    RETURN 0.00;
  END IF;

  -- Média ponderada pela quantidade para obter o verdadeiro preço médio pago
  SELECT
    CASE
      WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total, i.price * i.quantity) WHEN 'line_total' THEN i.price END) / SUM(i.quantity), 2)
      ELSE 0.00
    END
  INTO v_avg_price
  FROM items i
  INNER JOIN purchases p ON p.id = i.purchase_id
  WHERE i.price_basis IN ('unit', 'line_total') AND p.user_id = v_user_id
    AND (i.name ILIKE btrim(p_item_name) || '%' OR i.name ILIKE '% ' || btrim(p_item_name) || '%');

  RETURN COALESCE(v_avg_price, 0.00);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."get_items_average_prices_bulk"("p_item_names" "text"[]) RETURNS TABLE("item_name" "text", "avg_price" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  IF p_item_names IS NULL OR cardinality(p_item_names) = 0 THEN
    RETURN;
  END IF;

  IF cardinality(p_item_names) > 100 THEN
    RAISE EXCEPTION 'Limite de 100 nomes por consulta excedido'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_item_names) AS candidate_name
    WHERE candidate_name IS NOT NULL AND char_length(candidate_name) > 200
  ) THEN
    RAISE EXCEPTION 'Nome de item excede 200 caracteres'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN QUERY
  SELECT
    name_param AS item_name,
    COALESCE(
      (
        SELECT CASE
          WHEN name_param IS NULL OR btrim(name_param) = '' THEN 0.00
          WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total, i.price * i.quantity) WHEN 'line_total' THEN i.price END) / SUM(i.quantity), 2)
          ELSE 0.00
        END
        FROM public.items i
        INNER JOIN public.purchases p ON p.id = i.purchase_id
        WHERE i.price_basis IN ('unit', 'line_total') AND p.user_id = v_user_id
          AND name_param IS NOT NULL
          AND btrim(name_param) <> ''
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

CREATE OR REPLACE FUNCTION "public"."report_top_items"("p_limit" integer DEFAULT 10, "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("name" "text", "quantity" numeric, "total" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT
    COALESCE(i.name, 'Sem nome') AS name,
    COALESCE(SUM(i.quantity), 0) AS quantity,
    COALESCE(SUM(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total, i.price * i.quantity) WHEN 'line_total' THEN i.price END), 0) AS total
  FROM public.items i
  INNER JOIN public.purchases p ON p.id = i.purchase_id
  WHERE i.price_basis IN ('unit', 'line_total') AND p.user_id = auth.uid()
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(i.name, 'Sem nome')
  ORDER BY total DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
$$;

CREATE OR REPLACE FUNCTION "public"."report_top_items"("p_user_id" "uuid", "p_limit" integer DEFAULT 10, "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("name" "text", "quantity" numeric, "total" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT
    COALESCE(i.name, 'Sem nome') AS name,
    COALESCE(SUM(i.quantity), 0) AS quantity,
    COALESCE(SUM(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total, i.price * i.quantity) WHEN 'line_total' THEN i.price END), 0) AS total
  FROM items i
  INNER JOIN purchases p ON p.id = i.purchase_id
  WHERE i.price_basis IN ('unit', 'line_total') AND p.user_id = p_user_id
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(i.name, 'Sem nome')
  ORDER BY total DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;


CREATE OR REPLACE FUNCTION "public"."run_analytics_aggregation"("p_bucket_date" "date" DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_min_contributors INTEGER := 5;
BEGIN
  -- analytics_item_prices: preço por item normalizado, por mercado, por dia
  INSERT INTO analytics_item_prices (
    bucket_date,
    city,
    state,
    supermarket_id,
    normalized_item_name,
    unit,
    avg_unit_price,
    min_unit_price,
    max_unit_price,
    sample_count,
    contributor_count
  )
  SELECT
    p_bucket_date,
    NULL::TEXT AS city,
    NULL::TEXT AS state,
    p.supermarket_id,
    lower(btrim(i.name)) AS normalized_item_name,
    i.unit,
    ROUND(AVG(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total / GREATEST(i.quantity, 0.001), i.price) WHEN 'line_total' THEN i.price / GREATEST(i.quantity, 0.001) END)::NUMERIC, 4) AS avg_unit_price,
    ROUND(MIN(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total / GREATEST(i.quantity, 0.001), i.price) WHEN 'line_total' THEN i.price / GREATEST(i.quantity, 0.001) END)::NUMERIC, 4) AS min_unit_price,
    ROUND(MAX(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total / GREATEST(i.quantity, 0.001), i.price) WHEN 'line_total' THEN i.price / GREATEST(i.quantity, 0.001) END)::NUMERIC, 4) AS max_unit_price,
    COUNT(*) AS sample_count,
    COUNT(DISTINCT p.user_id) AS contributor_count
  FROM purchases p
  JOIN items i ON i.purchase_id = p.id
  WHERE p.date = p_bucket_date
    AND i.price_basis IN ('unit', 'line_total')
    AND i.price > 0
    AND char_length(btrim(i.name)) > 0
  GROUP BY p.supermarket_id, lower(btrim(i.name)), i.unit
  HAVING COUNT(DISTINCT p.user_id) >= v_min_contributors
  ON CONFLICT (bucket_date, normalized_item_name, COALESCE(supermarket_id, 0), COALESCE(city, ''), COALESCE(unit, ''))
  DO UPDATE SET
    avg_unit_price = EXCLUDED.avg_unit_price,
    min_unit_price = EXCLUDED.min_unit_price,
    max_unit_price = EXCLUDED.max_unit_price,
    sample_count = EXCLUDED.sample_count,
    contributor_count = EXCLUDED.contributor_count;

  -- analytics_market_baskets: cesta por mercado por dia
  INSERT INTO analytics_market_baskets (
    bucket_date,
    city,
    state,
    supermarket_id,
    basket_key,
    avg_basket_price,
    min_basket_price,
    max_basket_price,
    sample_count,
    contributor_count
  )
  SELECT
    p_bucket_date,
    NULL::TEXT AS city,
    NULL::TEXT AS state,
    p.supermarket_id,
    COALESCE(s.name, 'sem_mercado') AS basket_key,
    ROUND(AVG(p.total_price)::NUMERIC, 2) AS avg_basket_price,
    ROUND(MIN(p.total_price)::NUMERIC, 2) AS min_basket_price,
    ROUND(MAX(p.total_price)::NUMERIC, 2) AS max_basket_price,
    COUNT(*) AS sample_count,
    COUNT(DISTINCT p.user_id) AS contributor_count
  FROM purchases p
  LEFT JOIN supermarkets s ON s.id = p.supermarket_id
  WHERE p.date = p_bucket_date
    AND p.total_price > 0
  GROUP BY p.supermarket_id, COALESCE(s.name, 'sem_mercado')
  HAVING COUNT(DISTINCT p.user_id) >= v_min_contributors
  ON CONFLICT (bucket_date, basket_key, COALESCE(supermarket_id, 0), COALESCE(city, ''))
  DO UPDATE SET
    avg_basket_price = EXCLUDED.avg_basket_price,
    min_basket_price = EXCLUDED.min_basket_price,
    max_basket_price = EXCLUDED.max_basket_price,
    sample_count = EXCLUDED.sample_count,
    contributor_count = EXCLUDED.contributor_count;

  -- analytics_price_trends: tendência mensal por item
  INSERT INTO analytics_price_trends (
    bucket_month,
    city,
    state,
    normalized_item_name,
    avg_price,
    price_change_percent,
    sample_count,
    contributor_count
  )
  SELECT
    date_trunc('month', p_bucket_date)::DATE AS bucket_month,
    NULL::TEXT AS city,
    NULL::TEXT AS state,
    lower(btrim(i.name)) AS normalized_item_name,
    ROUND(AVG(CASE i.price_basis WHEN 'unit' THEN COALESCE(i.line_total / GREATEST(i.quantity, 0.001), i.price) WHEN 'line_total' THEN i.price / GREATEST(i.quantity, 0.001) END)::NUMERIC, 4) AS avg_price,
    NULL::NUMERIC AS price_change_percent,
    COUNT(*) AS sample_count,
    COUNT(DISTINCT p.user_id) AS contributor_count
  FROM purchases p
  JOIN items i ON i.purchase_id = p.id
  WHERE date_trunc('month', p.date) = date_trunc('month', p_bucket_date)
    AND i.price_basis IN ('unit', 'line_total')
    AND i.price > 0
    AND char_length(btrim(i.name)) > 0
  GROUP BY lower(btrim(i.name))
  HAVING COUNT(DISTINCT p.user_id) >= v_min_contributors
  ON CONFLICT (bucket_month, normalized_item_name, COALESCE(city, ''))
  DO UPDATE SET
    avg_price = EXCLUDED.avg_price,
    sample_count = EXCLUDED.sample_count,
    contributor_count = EXCLUDED.contributor_count;

END;
$$;
