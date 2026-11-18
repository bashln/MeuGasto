


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Extensions used by the base schema and its indexes are not included in
-- pg_dump's schema output.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;


-- pg_dump does not include custom role creation. Keep the baseline
-- self-contained for a fresh Supabase project.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'analytics_reader') THEN
    CREATE ROLE analytics_reader NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'support_limited') THEN
    CREATE ROLE support_limited NOLOGIN;
  END IF;
END
$$;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "private"."consume_authenticated_write_budget"("p_user_id" "uuid", "p_action" "text", "p_max_requests" integer, "p_now" timestamp with time zone DEFAULT "statement_timestamp"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
DECLARE
  v_request_count INTEGER;
BEGIN
  IF p_user_id IS NULL
    OR p_action IS NULL
    OR char_length(p_action) NOT BETWEEN 1 AND 200
    OR p_max_requests NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'Configuração de rate limit inválida'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO private.authenticated_write_rate_limits AS limits (
    user_id,
    action,
    window_started_at,
    request_count
  ) VALUES (
    p_user_id,
    p_action,
    p_now,
    1
  )
  ON CONFLICT (user_id, action) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= p_now - INTERVAL '1 hour' THEN p_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= p_now - INTERVAL '1 hour' THEN 1
      ELSE limits.request_count + 1
    END
  RETURNING request_count INTO v_request_count;

  IF v_request_count > p_max_requests THEN
    RAISE EXCEPTION 'Rate limit de % operacoes por hora excedido para %',
      p_max_requests,
      p_action
      USING ERRCODE = 'program_limit_exceeded';
  END IF;
END;
$$;


ALTER FUNCTION "private"."consume_authenticated_write_budget"("p_user_id" "uuid", "p_action" "text", "p_max_requests" integer, "p_now" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."enforce_authenticated_write_rate_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'private'
    AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_action TEXT := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || ':' || TG_OP;
  v_max_requests INTEGER;
BEGIN
  -- Service operations have no end-user JWT. RLS remains responsible for
  -- rejecting unauthenticated writes made through the public API.
  IF v_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'supermarkets' THEN v_max_requests := 240;
    WHEN 'purchases' THEN v_max_requests := 120;
    WHEN 'drafts' THEN v_max_requests := 240;
    WHEN 'shopping_lists' THEN v_max_requests := 240;
    WHEN 'price_comparison_sessions' THEN v_max_requests := 240;
    WHEN 'price_comparison_quotes' THEN v_max_requests := 600;
    WHEN 'learned_reclassifications' THEN v_max_requests := 1000;
    ELSE
      RAISE EXCEPTION 'Tabela sem rate limit configurado: %', TG_TABLE_NAME;
  END CASE;

  PERFORM private.consume_authenticated_write_budget(
    v_user_id,
    v_action,
    v_max_requests,
    statement_timestamp()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "private"."enforce_authenticated_write_rate_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_reference_supermarket"("p_supermarket_id" integer) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT p_supermarket_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.supermarkets s
    WHERE s.id = p_supermarket_id
      AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  );
$$;


ALTER FUNCTION "public"."can_reference_supermarket"("p_supermarket_id" integer) OWNER TO "postgres";


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

    v_line_total := ROUND(v_quantity * v_price, 2);
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
     LIMIT 1;
  END IF;

  IF v_purchase_id IS NOT NULL THEN
    RETURN QUERY SELECT v_purchase_id;
    RETURN;
  END IF;

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
$_$;


ALTER FUNCTION "public"."create_purchase_with_items"("p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_purchase_with_items"("p_user_id" "uuid", "p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb" DEFAULT '[]'::"jsonb") RETURNS TABLE("purchase_id" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."create_purchase_with_items"("p_user_id" "uuid", "p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_comparison_quote_items_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.price_comparison_quote_items pcqi
    WHERE pcqi.quote_id = NEW.quote_id
  ) >= 300 THEN
    RAISE EXCEPTION 'Limite de 300 itens por cotacao excedido'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_comparison_quote_items_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_comparison_quotes_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.price_comparison_quotes pcq
    WHERE pcq.session_id = NEW.session_id
  ) >= 100 THEN
    RAISE EXCEPTION 'Limite de 100 cotacoes por comparacao excedido'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_comparison_quotes_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_items_per_purchase_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF (SELECT count(*) FROM public.items i WHERE i.purchase_id = NEW.purchase_id) >= 300 THEN
    RAISE EXCEPTION 'Limite de 300 itens por compra excedido'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_items_per_purchase_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_owned_row_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
  v_current_count BIGINT;
  v_max_rows INTEGER;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'supermarkets' THEN
      v_max_rows := 1000;
      SELECT count(*) INTO v_current_count FROM public.supermarkets WHERE user_id = auth.uid();
    WHEN 'purchases' THEN
      v_max_rows := 10000;
      SELECT count(*) INTO v_current_count FROM public.purchases WHERE user_id = auth.uid();
    WHEN 'drafts' THEN
      v_max_rows := 1000;
      SELECT count(*) INTO v_current_count FROM public.drafts WHERE user_id = auth.uid();
    WHEN 'shopping_lists' THEN
      v_max_rows := 1000;
      SELECT count(*) INTO v_current_count FROM public.shopping_lists WHERE user_id = auth.uid();
    WHEN 'price_comparison_sessions' THEN
      v_max_rows := 1000;
      SELECT count(*) INTO v_current_count FROM public.price_comparison_sessions WHERE user_id = auth.uid();
    WHEN 'learned_reclassifications' THEN
      v_max_rows := 10000;
      SELECT count(*) INTO v_current_count FROM public.learned_reclassifications WHERE user_id = auth.uid();
    ELSE
      RAISE EXCEPTION 'Tabela sem quota configurada: %', TG_TABLE_NAME;
  END CASE;

  IF v_current_count >= v_max_rows THEN
    RAISE EXCEPTION 'Limite de % registros em % excedido', v_max_rows, TG_TABLE_NAME
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_owned_row_quota"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_shopping_list_items_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.shopping_list_items sli
    WHERE sli.shopping_list_id = NEW.shopping_list_id
  ) >= 300 THEN
    RAISE EXCEPTION 'Limite de 300 itens por lista excedido'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_shopping_list_items_limit"() OWNER TO "postgres";


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
      WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(i.price * i.quantity) / SUM(i.quantity), 2)
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


ALTER FUNCTION "public"."get_item_average_price"("p_item_name" "text") OWNER TO "postgres";


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
          WHEN SUM(i.quantity) > 0 THEN ROUND(SUM(i.price * i.quantity) / SUM(i.quantity), 2)
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


ALTER FUNCTION "public"."get_items_average_prices_bulk"("p_item_names" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_draft_content"("p_content" "text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  DECLARE
    v_content JSONB;
  BEGIN
    IF p_content IS NULL THEN
      RETURN TRUE;
    END IF;

    BEGIN
      v_content := p_content::JSONB;
    EXCEPTION
      WHEN others THEN
        RETURN FALSE;
    END;

    IF jsonb_typeof(v_content) <> 'object' THEN
      RETURN FALSE;
    END IF;

    IF COALESCE(v_content->>'version', '') <> '1' THEN
      RETURN FALSE;
    END IF;

    IF jsonb_typeof(COALESCE(v_content->'notes', '""'::JSONB)) <> 'string' THEN
      RETURN FALSE;
    END IF;

    RETURN public.is_valid_draft_items(COALESCE(v_content->'items', '[]'::JSONB));
  END;
  $$;


ALTER FUNCTION "public"."is_valid_draft_content"("p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_draft_items"("p_items" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  DECLARE
    v_item JSONB;
    v_quantity NUMERIC;
    v_price NUMERIC;
  BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
      RETURN FALSE;
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      IF jsonb_typeof(v_item) <> 'object' THEN
        RETURN FALSE;
      END IF;

      IF jsonb_typeof(v_item->'name') <> 'string' OR char_length(btrim(COALESCE(v_item->>'name', ''))) = 0 THEN
        RETURN FALSE;
      END IF;

      IF v_item ? 'unit' AND jsonb_typeof(v_item->'unit') <> 'string' THEN
        RETURN FALSE;
      END IF;

      BEGIN
        v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1);
        v_price := COALESCE(NULLIF(v_item->>'price', '')::NUMERIC, 0);
      EXCEPTION
        WHEN invalid_text_representation THEN
          RETURN FALSE;
      END;

      IF v_quantity <= 0 OR v_price < 0 THEN
        RETURN FALSE;
      END IF;
    END LOOP;

    RETURN TRUE;
  END;
  $$;


ALTER FUNCTION "public"."is_valid_draft_items"("p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_draft_content"("p_content" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  DECLARE
    v_content JSONB;
    v_notes TEXT;
    v_items JSONB;
  BEGIN
    IF p_content IS NULL THEN
      RETURN NULL;
    END IF;

    BEGIN
      v_content := p_content::JSONB;
    EXCEPTION
      WHEN others THEN
        RETURN jsonb_build_object(
          'version', 1,
          'notes', p_content,
          'items', '[]'::JSONB
        )::TEXT;
    END;

    IF jsonb_typeof(v_content) <> 'object' THEN
      RETURN jsonb_build_object(
        'version', 1,
        'notes', p_content,
        'items', '[]'::JSONB
      )::TEXT;
    END IF;

    IF COALESCE(v_content->>'version', '') = '1' AND public.is_valid_draft_content(p_content) THEN
      RETURN jsonb_build_object(
        'version', 1,
        'notes', COALESCE(v_content->>'notes', ''),
        'items', COALESCE(v_content->'items', '[]'::JSONB)
      )::TEXT;
    END IF;

    IF jsonb_typeof(COALESCE(v_content->'notes', '""'::JSONB)) = 'string'
       AND jsonb_typeof(COALESCE(v_content->'items', '[]'::JSONB)) = 'array' THEN
      v_notes := COALESCE(v_content->>'notes', '');
      v_items := COALESCE(v_content->'items', '[]'::JSONB);

      RETURN jsonb_build_object(
        'version', 1,
        'notes', v_notes,
        'items', v_items
      )::TEXT;
    END IF;

    RETURN jsonb_build_object(
      'version', 1,
      'notes', p_content,
      'items', '[]'::JSONB
    )::TEXT;
  END;
  $$;


ALTER FUNCTION "public"."normalize_draft_content"("p_content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_imported_purchase_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  BEGIN
    IF OLD.manual = false THEN
      RAISE EXCEPTION 'Compras importadas via NFC-e não podem ser alteradas';
    END IF;

    RETURN NEW;
  END;
  $$;


ALTER FUNCTION "public"."prevent_imported_purchase_updates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_role_escalation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.role := OLD.role;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_role_escalation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_expenses_by_supermarket"("p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("supermarket" "text", "total" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."report_expenses_by_supermarket"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_expenses_by_supermarket"("p_user_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("supermarket" "text", "total" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."report_expenses_by_supermarket"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_top_items"("p_limit" integer DEFAULT 10, "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("name" "text", "quantity" numeric, "total" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT
    COALESCE(i.name, 'Sem nome') AS name,
    COALESCE(SUM(i.quantity), 0) AS quantity,
    COALESCE(SUM(i.quantity * i.price), 0) AS total
  FROM public.items i
  INNER JOIN public.purchases p ON p.id = i.purchase_id
  WHERE p.user_id = auth.uid()
    AND (p_start_date IS NULL OR p.date >= p_start_date)
    AND (p_end_date IS NULL OR p.date <= p_end_date)
  GROUP BY COALESCE(i.name, 'Sem nome')
  ORDER BY total DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
$$;


ALTER FUNCTION "public"."report_top_items"("p_limit" integer, "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_top_items"("p_user_id" "uuid", "p_limit" integer DEFAULT 10, "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("name" "text", "quantity" numeric, "total" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'pg_catalog', 'public'
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


ALTER FUNCTION "public"."report_top_items"("p_user_id" "uuid", "p_limit" integer, "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


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
    ROUND(AVG(i.price / GREATEST(i.quantity, 0.001))::NUMERIC, 4) AS avg_unit_price,
    ROUND(MIN(i.price / GREATEST(i.quantity, 0.001))::NUMERIC, 4) AS min_unit_price,
    ROUND(MAX(i.price / GREATEST(i.quantity, 0.001))::NUMERIC, 4) AS max_unit_price,
    COUNT(*) AS sample_count,
    COUNT(DISTINCT p.user_id) AS contributor_count
  FROM purchases p
  JOIN items i ON i.purchase_id = p.id
  WHERE p.date = p_bucket_date
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
    ROUND(AVG(i.price / GREATEST(i.quantity, 0.001))::NUMERIC, 4) AS avg_price,
    NULL::NUMERIC AS price_change_percent,
    COUNT(*) AS sample_count,
    COUNT(DISTINCT p.user_id) AS contributor_count
  FROM purchases p
  JOIN items i ON i.purchase_id = p.id
  WHERE date_trunc('month', p.date) = date_trunc('month', p_bucket_date)
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


ALTER FUNCTION "public"."run_analytics_aggregation"("p_bucket_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_price_comparison_session_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_price_comparison_session_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "private"."authenticated_write_rate_limits" (
    "user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "window_started_at" timestamp with time zone NOT NULL,
    "request_count" integer NOT NULL,
    CONSTRAINT "authenticated_write_rate_limits_request_count_check" CHECK (("request_count" > 0))
);


ALTER TABLE "private"."authenticated_write_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_item_prices" (
    "id" bigint NOT NULL,
    "bucket_date" "date" NOT NULL,
    "city" "text",
    "state" "text",
    "supermarket_id" integer,
    "normalized_item_name" "text" NOT NULL,
    "unit" "text",
    "avg_unit_price" numeric(10,4) NOT NULL,
    "min_unit_price" numeric(10,4) NOT NULL,
    "max_unit_price" numeric(10,4) NOT NULL,
    "sample_count" integer NOT NULL,
    "contributor_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_item_prices_contributor_min" CHECK (("contributor_count" >= 5)),
    CONSTRAINT "analytics_item_prices_sample_min" CHECK (("sample_count" >= 1))
);


ALTER TABLE "public"."analytics_item_prices" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_item_prices_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."analytics_item_prices_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_item_prices_id_seq" OWNED BY "public"."analytics_item_prices"."id";



CREATE TABLE IF NOT EXISTS "public"."analytics_market_baskets" (
    "id" bigint NOT NULL,
    "bucket_date" "date" NOT NULL,
    "city" "text",
    "state" "text",
    "supermarket_id" integer,
    "basket_key" "text" NOT NULL,
    "avg_basket_price" numeric(10,2) NOT NULL,
    "min_basket_price" numeric(10,2) NOT NULL,
    "max_basket_price" numeric(10,2) NOT NULL,
    "sample_count" integer NOT NULL,
    "contributor_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_market_baskets_contributor_min" CHECK (("contributor_count" >= 5))
);


ALTER TABLE "public"."analytics_market_baskets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_market_baskets_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."analytics_market_baskets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_market_baskets_id_seq" OWNED BY "public"."analytics_market_baskets"."id";



CREATE TABLE IF NOT EXISTS "public"."analytics_price_trends" (
    "id" bigint NOT NULL,
    "bucket_month" "date" NOT NULL,
    "city" "text",
    "state" "text",
    "normalized_item_name" "text" NOT NULL,
    "avg_price" numeric(10,4) NOT NULL,
    "price_change_percent" numeric(8,4),
    "sample_count" integer NOT NULL,
    "contributor_count" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "analytics_price_trends_contributor_min" CHECK (("contributor_count" >= 5))
);


ALTER TABLE "public"."analytics_price_trends" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."analytics_price_trends_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."analytics_price_trends_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."analytics_price_trends_id_seq" OWNED BY "public"."analytics_price_trends"."id";



CREATE TABLE IF NOT EXISTS "public"."drafts" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "supermarket_id" integer,
    "content" "text",
    "total_price" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "drafts_content_canonical_check" CHECK ("public"."is_valid_draft_content"("content"))
);


ALTER TABLE "public"."drafts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."drafts_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."drafts_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."drafts_id_seq" OWNED BY "public"."drafts"."id";



CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" integer NOT NULL,
    "purchase_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "quantity" numeric(10,3) DEFAULT 1,
    "unit" "text",
    "price" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category_id" integer
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."items_id_seq" OWNED BY "public"."items"."id";



CREATE TABLE IF NOT EXISTS "public"."learned_reclassifications" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "normalized_name" "text" NOT NULL,
    "category_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "learned_reclassifications_name_length_check" CHECK ((("char_length"("btrim"("normalized_name")) > 0) AND ("char_length"("normalized_name") <= 200)))
);


ALTER TABLE "public"."learned_reclassifications" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."learned_reclassifications_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."learned_reclassifications_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."learned_reclassifications_id_seq" OWNED BY "public"."learned_reclassifications"."id";



CREATE TABLE IF NOT EXISTS "public"."price_comparison_quote_items" (
    "id" integer NOT NULL,
    "quote_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "normalized_name" "text",
    "quantity" numeric(10,3) DEFAULT 1,
    "unit" "text" DEFAULT 'UN'::"text",
    "price" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_comparison_quote_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_comparison_quote_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_comparison_quote_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_comparison_quote_items_id_seq" OWNED BY "public"."price_comparison_quote_items"."id";



CREATE TABLE IF NOT EXISTS "public"."price_comparison_quotes" (
    "id" integer NOT NULL,
    "session_id" integer NOT NULL,
    "supermarket_id" integer,
    "market_name_snapshot" "text" NOT NULL,
    "notes" "text",
    "total_price" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_comparison_quotes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_comparison_quotes_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_comparison_quotes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_comparison_quotes_id_seq" OWNED BY "public"."price_comparison_quotes"."id";



CREATE TABLE IF NOT EXISTS "public"."price_comparison_sessions" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "source_shopping_list_id" integer,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_comparison_sessions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."price_comparison_sessions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."price_comparison_sessions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."price_comparison_sessions_id_seq" OWNED BY "public"."price_comparison_sessions"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "supermarket_id" integer,
    "access_key" "text",
    "date" "date" NOT NULL,
    "total_price" numeric(10,2) DEFAULT 0,
    "manual" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "access_key_hash" "text"
);


ALTER TABLE "public"."purchases" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."purchases_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."purchases_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."purchases_id_seq" OWNED BY "public"."purchases"."id";



CREATE TABLE IF NOT EXISTS "public"."sensitive_access_audit" (
    "id" bigint NOT NULL,
    "actor" "text" NOT NULL,
    "action" "text" NOT NULL,
    "justification" "text",
    "target_table" "text",
    "row_count" integer,
    "accessed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_by" "text",
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."sensitive_access_audit" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sensitive_access_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sensitive_access_audit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sensitive_access_audit_id_seq" OWNED BY "public"."sensitive_access_audit"."id";



CREATE TABLE IF NOT EXISTS "public"."shopping_list_items" (
    "id" integer NOT NULL,
    "shopping_list_id" integer NOT NULL,
    "name" "text" NOT NULL,
    "quantity" numeric(10,3) DEFAULT 1,
    "unit" "text" DEFAULT 'UN'::"text",
    "estimated_price" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shopping_list_items_estimated_price_check" CHECK (("estimated_price" >= (0)::numeric)),
    CONSTRAINT "shopping_list_items_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."shopping_list_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."shopping_list_items_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shopping_list_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shopping_list_items_id_seq" OWNED BY "public"."shopping_list_items"."id";



CREATE TABLE IF NOT EXISTS "public"."shopping_lists" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shopping_lists_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."shopping_lists" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."shopping_lists_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."shopping_lists_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."shopping_lists_id_seq" OWNED BY "public"."shopping_lists"."id";



CREATE TABLE IF NOT EXISTS "public"."supermarkets" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "cnpj" "text",
    "city" "text",
    "state" "text",
    "manual" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."supermarkets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."supermarkets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."supermarkets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."supermarkets_id_seq" OWNED BY "public"."supermarkets"."id";



ALTER TABLE ONLY "public"."analytics_item_prices" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_item_prices_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics_market_baskets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_market_baskets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."analytics_price_trends" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."analytics_price_trends_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."drafts" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."drafts_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."learned_reclassifications" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."learned_reclassifications_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."price_comparison_quote_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_comparison_quote_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."price_comparison_quotes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_comparison_quotes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."price_comparison_sessions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."price_comparison_sessions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."purchases" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."purchases_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sensitive_access_audit" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sensitive_access_audit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shopping_list_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shopping_list_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."shopping_lists" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."shopping_lists_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."supermarkets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."supermarkets_id_seq"'::"regclass");



ALTER TABLE ONLY "private"."authenticated_write_rate_limits"
    ADD CONSTRAINT "authenticated_write_rate_limits_pkey" PRIMARY KEY ("user_id", "action");



ALTER TABLE ONLY "public"."analytics_item_prices"
    ADD CONSTRAINT "analytics_item_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_market_baskets"
    ADD CONSTRAINT "analytics_market_baskets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_price_trends"
    ADD CONSTRAINT "analytics_price_trends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."drafts"
    ADD CONSTRAINT "drafts_total_price_security_check" CHECK ((("total_price" >= (0)::numeric) AND ("total_price" <= 99999999.99))) NOT VALID;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learned_reclassifications"
    ADD CONSTRAINT "learned_reclassifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_comparison_quote_items"
    ADD CONSTRAINT "price_comparison_quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."price_comparison_quote_items"
    ADD CONSTRAINT "price_comparison_quote_items_security_bounds_check" CHECK (((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 200)) AND (("normalized_name" IS NULL) OR ("char_length"("normalized_name") <= 200)) AND ("quantity" > (0)::numeric) AND ("quantity" <= (99999)::numeric) AND (("char_length"("unit") >= 1) AND ("char_length"("unit") <= 16)) AND ("price" >= (0)::numeric) AND ("price" <= 99999999.99))) NOT VALID;



ALTER TABLE ONLY "public"."price_comparison_quotes"
    ADD CONSTRAINT "price_comparison_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."price_comparison_quotes"
    ADD CONSTRAINT "price_comparison_quotes_security_bounds_check" CHECK (((("char_length"("btrim"("market_name_snapshot")) >= 1) AND ("char_length"("btrim"("market_name_snapshot")) <= 200)) AND (("notes" IS NULL) OR ("char_length"("notes") <= 5000)) AND ("total_price" >= (0)::numeric) AND ("total_price" <= 99999999.99))) NOT VALID;



ALTER TABLE ONLY "public"."price_comparison_sessions"
    ADD CONSTRAINT "price_comparison_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."price_comparison_sessions"
    ADD CONSTRAINT "price_comparison_sessions_security_bounds_check" CHECK (((("char_length"("btrim"("title")) >= 1) AND ("char_length"("btrim"("title")) <= 200)) AND ("expires_at" > "created_at"))) NOT VALID;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sensitive_access_audit"
    ADD CONSTRAINT "sensitive_access_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."sensitive_access_audit"
    ADD CONSTRAINT "sensitive_access_audit_security_bounds_check" CHECK (((("char_length"("actor") >= 1) AND ("char_length"("actor") <= 200)) AND (("char_length"("action") >= 1) AND ("char_length"("action") <= 200)) AND (("justification" IS NULL) OR ("char_length"("justification") <= 2000)) AND (("target_table" IS NULL) OR ("char_length"("target_table") <= 200)) AND (("approved_by" IS NULL) OR ("char_length"("approved_by") <= 200)) AND (("row_count" IS NULL) OR ("row_count" >= 0)))) NOT VALID;



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_security_bounds_check" CHECK (((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 200)) AND ("quantity" > (0)::numeric) AND ("quantity" <= (99999)::numeric) AND (("char_length"("unit") >= 1) AND ("char_length"("unit") <= 16)) AND ("estimated_price" >= (0)::numeric) AND ("estimated_price" <= 99999999.99))) NOT VALID;



ALTER TABLE ONLY "public"."shopping_lists"
    ADD CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."shopping_lists"
    ADD CONSTRAINT "shopping_lists_security_bounds_check" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 120))) NOT VALID;



ALTER TABLE ONLY "public"."supermarkets"
    ADD CONSTRAINT "supermarkets_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."supermarkets"
    ADD CONSTRAINT "supermarkets_security_bounds_check" CHECK (((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 200)) AND (("cnpj" IS NULL) OR ("char_length"("cnpj") <= 18)) AND (("city" IS NULL) OR ("char_length"("city") <= 120)) AND (("state" IS NULL) OR ("state" ~ '^[A-Z]{2}$'::"text")))) NOT VALID;



CREATE UNIQUE INDEX "idx_analytics_item_prices_bucket" ON "public"."analytics_item_prices" USING "btree" ("bucket_date", "normalized_item_name", COALESCE("supermarket_id", 0), COALESCE("city", ''::"text"), COALESCE("unit", ''::"text"));



CREATE INDEX "idx_analytics_item_prices_date" ON "public"."analytics_item_prices" USING "btree" ("bucket_date");



CREATE INDEX "idx_analytics_item_prices_item" ON "public"."analytics_item_prices" USING "btree" ("normalized_item_name");



CREATE INDEX "idx_analytics_item_prices_supermarket" ON "public"."analytics_item_prices" USING "btree" ("supermarket_id");



CREATE UNIQUE INDEX "idx_analytics_market_baskets_bucket" ON "public"."analytics_market_baskets" USING "btree" ("bucket_date", "basket_key", COALESCE("supermarket_id", 0), COALESCE("city", ''::"text"));



CREATE INDEX "idx_analytics_market_baskets_date" ON "public"."analytics_market_baskets" USING "btree" ("bucket_date");



CREATE INDEX "idx_analytics_market_baskets_supermarket" ON "public"."analytics_market_baskets" USING "btree" ("supermarket_id");



CREATE UNIQUE INDEX "idx_analytics_price_trends_bucket" ON "public"."analytics_price_trends" USING "btree" ("bucket_month", "normalized_item_name", COALESCE("city", ''::"text"));



CREATE INDEX "idx_analytics_price_trends_item" ON "public"."analytics_price_trends" USING "btree" ("normalized_item_name");



CREATE INDEX "idx_analytics_price_trends_month" ON "public"."analytics_price_trends" USING "btree" ("bucket_month");



CREATE INDEX "idx_drafts_supermarket_id" ON "public"."drafts" USING "btree" ("supermarket_id");



CREATE INDEX "idx_drafts_user_id" ON "public"."drafts" USING "btree" ("user_id");



CREATE INDEX "idx_items_name_trgm" ON "public"."items" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_items_purchase_id" ON "public"."items" USING "btree" ("purchase_id");



CREATE INDEX "idx_items_purchase_id_name" ON "public"."items" USING "btree" ("purchase_id", "name");



CREATE INDEX "idx_learned_reclassifications_user_id" ON "public"."learned_reclassifications" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_learned_reclassifications_user_name_unique" ON "public"."learned_reclassifications" USING "btree" ("user_id", "normalized_name");



CREATE INDEX "idx_pcq_session_id" ON "public"."price_comparison_quotes" USING "btree" ("session_id");



CREATE INDEX "idx_pcqi_quote_id" ON "public"."price_comparison_quote_items" USING "btree" ("quote_id");



CREATE INDEX "idx_pcs_expires_at" ON "public"."price_comparison_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_pcs_user_id" ON "public"."price_comparison_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_purchases_date" ON "public"."purchases" USING "btree" ("date");



CREATE INDEX "idx_purchases_supermarket_id" ON "public"."purchases" USING "btree" ("supermarket_id");



CREATE UNIQUE INDEX "idx_purchases_user_access_key_hash_unique" ON "public"."purchases" USING "btree" ("user_id", "access_key_hash") WHERE ("access_key_hash" IS NOT NULL);



CREATE INDEX "idx_purchases_user_id" ON "public"."purchases" USING "btree" ("user_id");



CREATE INDEX "idx_sensitive_access_audit_actor" ON "public"."sensitive_access_audit" USING "btree" ("actor", "accessed_at");



CREATE INDEX "idx_sensitive_access_audit_table" ON "public"."sensitive_access_audit" USING "btree" ("target_table", "accessed_at");



CREATE INDEX "idx_shopping_list_items_list_id" ON "public"."shopping_list_items" USING "btree" ("shopping_list_id");



CREATE INDEX "idx_shopping_lists_user_id" ON "public"."shopping_lists" USING "btree" ("user_id");



CREATE INDEX "idx_supermarkets_user_id" ON "public"."supermarkets" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "enforce_comparison_quote_items_limit" BEFORE INSERT ON "public"."price_comparison_quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_comparison_quote_items_limit"();



CREATE OR REPLACE TRIGGER "enforce_comparison_quotes_limit" BEFORE INSERT ON "public"."price_comparison_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_comparison_quotes_limit"();



CREATE OR REPLACE TRIGGER "enforce_drafts_owned_row_quota" BEFORE INSERT ON "public"."drafts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owned_row_quota"();



CREATE OR REPLACE TRIGGER "enforce_drafts_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."drafts" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "enforce_items_per_purchase_limit" BEFORE INSERT ON "public"."items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_items_per_purchase_limit"();



CREATE OR REPLACE TRIGGER "enforce_learned_reclassifications_owned_row_quota" BEFORE INSERT ON "public"."learned_reclassifications" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owned_row_quota"();



CREATE OR REPLACE TRIGGER "enforce_learned_reclassifications_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."learned_reclassifications" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "enforce_price_comparison_quotes_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."price_comparison_quotes" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "enforce_price_comparison_sessions_owned_row_quota" BEFORE INSERT ON "public"."price_comparison_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owned_row_quota"();



CREATE OR REPLACE TRIGGER "enforce_price_comparison_sessions_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."price_comparison_sessions" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "enforce_purchases_owned_row_quota" BEFORE INSERT ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owned_row_quota"();



CREATE OR REPLACE TRIGGER "enforce_purchases_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "enforce_shopping_list_items_limit" BEFORE INSERT ON "public"."shopping_list_items" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_shopping_list_items_limit"();



CREATE OR REPLACE TRIGGER "enforce_shopping_lists_owned_row_quota" BEFORE INSERT ON "public"."shopping_lists" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owned_row_quota"();



CREATE OR REPLACE TRIGGER "enforce_shopping_lists_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."shopping_lists" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "enforce_supermarkets_owned_row_quota" BEFORE INSERT ON "public"."supermarkets" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_owned_row_quota"();



CREATE OR REPLACE TRIGGER "enforce_supermarkets_write_rate_limit" BEFORE INSERT OR DELETE OR UPDATE ON "public"."supermarkets" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_authenticated_write_rate_limit"();



CREATE OR REPLACE TRIGGER "protect_imported_purchases" BEFORE UPDATE ON "public"."purchases" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_imported_purchase_updates"();



CREATE OR REPLACE TRIGGER "protect_profile_immutable_fields" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_role_escalation"();



CREATE OR REPLACE TRIGGER "set_updated_at_price_comparison_sessions" BEFORE UPDATE ON "public"."price_comparison_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_price_comparison_session_updated_at"();



ALTER TABLE ONLY "public"."analytics_item_prices"
    ADD CONSTRAINT "analytics_item_prices_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."analytics_market_baskets"
    ADD CONSTRAINT "analytics_market_baskets_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drafts"
    ADD CONSTRAINT "drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learned_reclassifications"
    ADD CONSTRAINT "learned_reclassifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_comparison_quote_items"
    ADD CONSTRAINT "price_comparison_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."price_comparison_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_comparison_quotes"
    ADD CONSTRAINT "price_comparison_quotes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."price_comparison_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_comparison_quotes"
    ADD CONSTRAINT "price_comparison_quotes_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."price_comparison_sessions"
    ADD CONSTRAINT "price_comparison_sessions_source_shopping_list_id_fkey" FOREIGN KEY ("source_shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."price_comparison_sessions"
    ADD CONSTRAINT "price_comparison_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_supermarket_id_fkey" FOREIGN KEY ("supermarket_id") REFERENCES "public"."supermarkets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchases"
    ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_list_items"
    ADD CONSTRAINT "shopping_list_items_shopping_list_id_fkey" FOREIGN KEY ("shopping_list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_lists"
    ADD CONSTRAINT "shopping_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supermarkets"
    ADD CONSTRAINT "supermarkets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE "private"."authenticated_write_rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can delete comparison quote items" ON "public"."price_comparison_quote_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."price_comparison_quotes"
     JOIN "public"."price_comparison_sessions" ON (("price_comparison_sessions"."id" = "price_comparison_quotes"."session_id")))
  WHERE (("price_comparison_quotes"."id" = "price_comparison_quote_items"."quote_id") AND ("price_comparison_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete comparison quotes" ON "public"."price_comparison_quotes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."price_comparison_sessions"
  WHERE (("price_comparison_sessions"."id" = "price_comparison_quotes"."session_id") AND ("price_comparison_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete items" ON "public"."items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."purchases"
  WHERE (("purchases"."id" = "items"."purchase_id") AND ("purchases"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own comparison sessions" ON "public"."price_comparison_sessions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own drafts" ON "public"."drafts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own purchases" ON "public"."purchases" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own reclassifications" ON "public"."learned_reclassifications" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own shopping list items" ON "public"."shopping_list_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."shopping_lists"
  WHERE (("shopping_lists"."id" = "shopping_list_items"."shopping_list_id") AND ("shopping_lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own shopping lists" ON "public"."shopping_lists" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own supermarkets" ON "public"."supermarkets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert comparison quote items" ON "public"."price_comparison_quote_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."price_comparison_quotes"
     JOIN "public"."price_comparison_sessions" ON (("price_comparison_sessions"."id" = "price_comparison_quotes"."session_id")))
  WHERE (("price_comparison_quotes"."id" = "price_comparison_quote_items"."quote_id") AND ("price_comparison_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert comparison quotes" ON "public"."price_comparison_quotes" FOR INSERT TO "authenticated" WITH CHECK (("public"."can_reference_supermarket"("supermarket_id") AND (EXISTS ( SELECT 1
   FROM "public"."price_comparison_sessions" "pcs"
  WHERE (("pcs"."id" = "price_comparison_quotes"."session_id") AND ("pcs"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert items" ON "public"."items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchases"
  WHERE (("purchases"."id" = "items"."purchase_id") AND ("purchases"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own comparison sessions" ON "public"."price_comparison_sessions" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (("source_shopping_list_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."shopping_lists" "sl"
  WHERE (("sl"."id" = "price_comparison_sessions"."source_shopping_list_id") AND ("sl"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can insert own drafts" ON "public"."drafts" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."can_reference_supermarket"("supermarket_id")));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own purchases" ON "public"."purchases" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."can_reference_supermarket"("supermarket_id")));



CREATE POLICY "Users can insert own reclassifications" ON "public"."learned_reclassifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own shopping list items" ON "public"."shopping_list_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shopping_lists"
  WHERE (("shopping_lists"."id" = "shopping_list_items"."shopping_list_id") AND ("shopping_lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own shopping lists" ON "public"."shopping_lists" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert supermarkets" ON "public"."supermarkets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update comparison quote items" ON "public"."price_comparison_quote_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."price_comparison_quotes"
     JOIN "public"."price_comparison_sessions" ON (("price_comparison_sessions"."id" = "price_comparison_quotes"."session_id")))
  WHERE (("price_comparison_quotes"."id" = "price_comparison_quote_items"."quote_id") AND ("price_comparison_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update comparison quotes" ON "public"."price_comparison_quotes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."price_comparison_sessions" "pcs"
  WHERE (("pcs"."id" = "price_comparison_quotes"."session_id") AND ("pcs"."user_id" = "auth"."uid"()))))) WITH CHECK (("public"."can_reference_supermarket"("supermarket_id") AND (EXISTS ( SELECT 1
   FROM "public"."price_comparison_sessions" "pcs"
  WHERE (("pcs"."id" = "price_comparison_quotes"."session_id") AND ("pcs"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update items" ON "public"."items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."purchases"
  WHERE (("purchases"."id" = "items"."purchase_id") AND ("purchases"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own comparison sessions" ON "public"."price_comparison_sessions" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND (("source_shopping_list_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."shopping_lists" "sl"
  WHERE (("sl"."id" = "price_comparison_sessions"."source_shopping_list_id") AND ("sl"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update own drafts" ON "public"."drafts" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."can_reference_supermarket"("supermarket_id")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own purchases" ON "public"."purchases" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."can_reference_supermarket"("supermarket_id")));



CREATE POLICY "Users can update own reclassifications" ON "public"."learned_reclassifications" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own shopping list items" ON "public"."shopping_list_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."shopping_lists"
  WHERE (("shopping_lists"."id" = "shopping_list_items"."shopping_list_id") AND ("shopping_lists"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."shopping_lists"
  WHERE (("shopping_lists"."id" = "shopping_list_items"."shopping_list_id") AND ("shopping_lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own shopping lists" ON "public"."shopping_lists" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own supermarkets" ON "public"."supermarkets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view items" ON "public"."items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."purchases"
  WHERE (("purchases"."id" = "items"."purchase_id") AND ("purchases"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own comparison quote items" ON "public"."price_comparison_quote_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."price_comparison_quotes"
     JOIN "public"."price_comparison_sessions" ON (("price_comparison_sessions"."id" = "price_comparison_quotes"."session_id")))
  WHERE (("price_comparison_quotes"."id" = "price_comparison_quote_items"."quote_id") AND ("price_comparison_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own comparison quotes" ON "public"."price_comparison_quotes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."price_comparison_sessions"
  WHERE (("price_comparison_sessions"."id" = "price_comparison_quotes"."session_id") AND ("price_comparison_sessions"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own comparison sessions" ON "public"."price_comparison_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own drafts" ON "public"."drafts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own purchases" ON "public"."purchases" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own reclassifications" ON "public"."learned_reclassifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own shopping list items" ON "public"."shopping_list_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."shopping_lists"
  WHERE (("shopping_lists"."id" = "shopping_list_items"."shopping_list_id") AND ("shopping_lists"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own shopping lists" ON "public"."shopping_lists" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view supermarkets" ON "public"."supermarkets" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL)));



ALTER TABLE "public"."analytics_item_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_item_prices_read" ON "public"."analytics_item_prices" FOR SELECT TO "analytics_reader" USING (("contributor_count" >= 5));



ALTER TABLE "public"."analytics_market_baskets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_market_baskets_read" ON "public"."analytics_market_baskets" FOR SELECT TO "analytics_reader" USING (("contributor_count" >= 5));



ALTER TABLE "public"."analytics_price_trends" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_price_trends_read" ON "public"."analytics_price_trends" FOR SELECT TO "analytics_reader" USING (("contributor_count" >= 5));



ALTER TABLE "public"."drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learned_reclassifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_comparison_quote_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_comparison_quotes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_comparison_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sensitive_access_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopping_list_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shopping_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supermarkets" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."consume_authenticated_write_budget"("p_user_id" "uuid", "p_action" "text", "p_max_requests" integer, "p_now" timestamp with time zone) FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."enforce_authenticated_write_rate_limit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."can_reference_supermarket"("p_supermarket_id" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_reference_supermarket"("p_supermarket_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."can_reference_supermarket"("p_supermarket_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_reference_supermarket"("p_supermarket_id" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_purchase_with_items"("p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_purchase_with_items"("p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_purchase_with_items"("p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_purchase_with_items"("p_user_id" "uuid", "p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_purchase_with_items"("p_user_id" "uuid", "p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_purchase_with_items"("p_user_id" "uuid", "p_supermarket_id" integer, "p_access_key" "text", "p_date" "date", "p_total_price" numeric, "p_manual" boolean, "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_comparison_quote_items_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_comparison_quote_items_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_comparison_quote_items_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_comparison_quote_items_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_comparison_quotes_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_comparison_quotes_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_comparison_quotes_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_comparison_quotes_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_items_per_purchase_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_items_per_purchase_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_items_per_purchase_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_items_per_purchase_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_owned_row_quota"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_owned_row_quota"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_owned_row_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_owned_row_quota"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_shopping_list_items_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enforce_shopping_list_items_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_shopping_list_items_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_shopping_list_items_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_item_average_price"("p_item_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_item_average_price"("p_item_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_item_average_price"("p_item_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_items_average_prices_bulk"("p_item_names" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_items_average_prices_bulk"("p_item_names" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_items_average_prices_bulk"("p_item_names" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_valid_draft_content"("p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_valid_draft_content"("p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_draft_content"("p_content" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_valid_draft_items"("p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_valid_draft_items"("p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_draft_items"("p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_draft_content"("p_content" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_draft_content"("p_content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_draft_content"("p_content" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_imported_purchase_updates"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_imported_purchase_updates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_role_escalation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_role_escalation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_expenses_by_supermarket"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_expenses_by_supermarket"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_expenses_by_supermarket"("p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_expenses_by_supermarket"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_expenses_by_supermarket"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_expenses_by_supermarket"("p_user_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_top_items"("p_limit" integer, "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_top_items"("p_limit" integer, "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_top_items"("p_limit" integer, "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."report_top_items"("p_user_id" "uuid", "p_limit" integer, "p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."report_top_items"("p_user_id" "uuid", "p_limit" integer, "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_top_items"("p_user_id" "uuid", "p_limit" integer, "p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_analytics_aggregation"("p_bucket_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_analytics_aggregation"("p_bucket_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_price_comparison_session_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_price_comparison_session_updated_at"() TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_item_prices" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_item_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_item_prices" TO "service_role";
GRANT SELECT ON TABLE "public"."analytics_item_prices" TO "analytics_reader";



GRANT ALL ON SEQUENCE "public"."analytics_item_prices_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_item_prices_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_item_prices_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_market_baskets" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_market_baskets" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_market_baskets" TO "service_role";
GRANT SELECT ON TABLE "public"."analytics_market_baskets" TO "analytics_reader";



GRANT ALL ON SEQUENCE "public"."analytics_market_baskets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_market_baskets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_market_baskets_id_seq" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_price_trends" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_price_trends" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_price_trends" TO "service_role";
GRANT SELECT ON TABLE "public"."analytics_price_trends" TO "analytics_reader";



GRANT ALL ON SEQUENCE "public"."analytics_price_trends_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."analytics_price_trends_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."analytics_price_trends_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."drafts" TO "anon";
GRANT ALL ON TABLE "public"."drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."drafts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."drafts_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."drafts_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."drafts_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."learned_reclassifications" TO "anon";
GRANT ALL ON TABLE "public"."learned_reclassifications" TO "authenticated";
GRANT ALL ON TABLE "public"."learned_reclassifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."learned_reclassifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."learned_reclassifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."learned_reclassifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_comparison_quote_items" TO "anon";
GRANT ALL ON TABLE "public"."price_comparison_quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."price_comparison_quote_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_comparison_quote_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_comparison_quote_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_comparison_quote_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_comparison_quotes" TO "anon";
GRANT ALL ON TABLE "public"."price_comparison_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."price_comparison_quotes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_comparison_quotes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_comparison_quotes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_comparison_quotes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."price_comparison_sessions" TO "anon";
GRANT ALL ON TABLE "public"."price_comparison_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."price_comparison_sessions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."price_comparison_sessions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."price_comparison_sessions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."price_comparison_sessions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."profiles" TO "support_limited";



GRANT SELECT("created_at") ON TABLE "public"."profiles" TO "support_limited";



GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "support_limited";



GRANT ALL ON TABLE "public"."purchases" TO "anon";
GRANT ALL ON TABLE "public"."purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."purchases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."purchases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."purchases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."purchases_id_seq" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."sensitive_access_audit" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."sensitive_access_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_list_items" TO "anon";
GRANT ALL ON TABLE "public"."shopping_list_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shopping_list_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shopping_list_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shopping_list_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shopping_list_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_lists" TO "anon";
GRANT ALL ON TABLE "public"."shopping_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."shopping_lists" TO "service_role";



GRANT ALL ON SEQUENCE "public"."shopping_lists_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."shopping_lists_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."shopping_lists_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."supermarkets" TO "anon";
GRANT ALL ON TABLE "public"."supermarkets" TO "authenticated";
GRANT ALL ON TABLE "public"."supermarkets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."supermarkets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."supermarkets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."supermarkets_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
