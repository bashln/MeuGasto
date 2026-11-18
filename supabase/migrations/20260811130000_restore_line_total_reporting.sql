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
      WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(i.price) / SUM(i.quantity), 2)
      ELSE 0.00
    END
  INTO v_avg_price
  FROM items i
  INNER JOIN purchases p ON p.id = i.purchase_id
  WHERE p.user_id = v_user_id
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
          WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(i.price) / SUM(i.quantity), 2)
          ELSE 0.00
        END
        FROM public.items i
        INNER JOIN public.purchases p ON p.id = i.purchase_id
        WHERE p.user_id = v_user_id
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
    COALESCE(SUM(i.price), 0) AS total
  FROM public.items i
  INNER JOIN public.purchases p ON p.id = i.purchase_id
  WHERE p.user_id = auth.uid()
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
    COALESCE(SUM(i.price), 0) AS total
  FROM items i
  INNER JOIN purchases p ON p.id = i.purchase_id
  WHERE p.user_id = p_user_id
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(i.name, 'Sem nome')
  ORDER BY total DESC
  LIMIT GREATEST(COALESCE(p_limit, 10), 1);
$$;
