-- =============================================================
-- SECURITY HARDENING — MeuGasto
-- Apply after the base schema and the privacy/comparison migrations.
-- Idempotent: policies, constraints and triggers are replaced by name.
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- Cross-user reference protection
-- A purchase/draft/quote may reference only a global supermarket
-- or a supermarket owned by the authenticated user.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_reference_supermarket(p_supermarket_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT p_supermarket_id IS NULL OR EXISTS (
    SELECT 1
    FROM public.supermarkets s
    WHERE s.id = p_supermarket_id
      AND (s.user_id = auth.uid() OR s.user_id IS NULL)
  );
$$;

REVOKE ALL ON FUNCTION public.can_reference_supermarket(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_reference_supermarket(INTEGER) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_reference_supermarket(supermarket_id)
  );

DROP POLICY IF EXISTS "Users can update own purchases" ON public.purchases;
CREATE POLICY "Users can update own purchases" ON public.purchases
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_reference_supermarket(supermarket_id)
  );

DROP POLICY IF EXISTS "Users can insert own drafts" ON public.drafts;
CREATE POLICY "Users can insert own drafts" ON public.drafts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_reference_supermarket(supermarket_id)
  );

DROP POLICY IF EXISTS "Users can update own drafts" ON public.drafts;
CREATE POLICY "Users can update own drafts" ON public.drafts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_reference_supermarket(supermarket_id)
  );

DROP POLICY IF EXISTS "Users can insert own comparison sessions" ON public.price_comparison_sessions;
CREATE POLICY "Users can insert own comparison sessions" ON public.price_comparison_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      source_shopping_list_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = price_comparison_sessions.source_shopping_list_id
          AND sl.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own comparison sessions" ON public.price_comparison_sessions;
CREATE POLICY "Users can update own comparison sessions" ON public.price_comparison_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      source_shopping_list_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = price_comparison_sessions.source_shopping_list_id
          AND sl.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert comparison quotes" ON public.price_comparison_quotes;
CREATE POLICY "Users can insert comparison quotes" ON public.price_comparison_quotes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_reference_supermarket(supermarket_id)
    AND EXISTS (
      SELECT 1
      FROM public.price_comparison_sessions pcs
      WHERE pcs.id = price_comparison_quotes.session_id
        AND pcs.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update comparison quotes" ON public.price_comparison_quotes;
CREATE POLICY "Users can update comparison quotes" ON public.price_comparison_quotes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.price_comparison_sessions pcs
      WHERE pcs.id = price_comparison_quotes.session_id
        AND pcs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.can_reference_supermarket(supermarket_id)
    AND EXISTS (
      SELECT 1
      FROM public.price_comparison_sessions pcs
      WHERE pcs.id = price_comparison_quotes.session_id
        AND pcs.user_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- Analytics are administrative aggregates, not a public API.
-- Removing client SELECT closes the Sybil inference oracle.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS analytics_item_prices_read ON public.analytics_item_prices;
DROP POLICY IF EXISTS analytics_market_baskets_read ON public.analytics_market_baskets;
DROP POLICY IF EXISTS analytics_price_trends_read ON public.analytics_price_trends;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.analytics_item_prices FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.analytics_market_baskets FROM PUBLIC, anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.analytics_price_trends FROM PUBLIC, anon, authenticated;

CREATE POLICY analytics_item_prices_read ON public.analytics_item_prices
  FOR SELECT TO analytics_reader
  USING (contributor_count >= 5);

CREATE POLICY analytics_market_baskets_read ON public.analytics_market_baskets
  FOR SELECT TO analytics_reader
  USING (contributor_count >= 5);

CREATE POLICY analytics_price_trends_read ON public.analytics_price_trends
  FOR SELECT TO analytics_reader
  USING (contributor_count >= 5);

GRANT SELECT ON public.analytics_item_prices TO analytics_reader;
GRANT SELECT ON public.analytics_market_baskets TO analytics_reader;
GRANT SELECT ON public.analytics_price_trends TO analytics_reader;

-- -------------------------------------------------------------
-- Audit log integrity: clients cannot insert, update or delete.
-- service_role can append and read; only postgres can maintain it.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS audit_insert_service ON public.sensitive_access_audit;
DROP POLICY IF EXISTS audit_select_service ON public.sensitive_access_audit;

REVOKE ALL ON public.sensitive_access_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sensitive_access_audit FROM service_role;
REVOKE ALL ON SEQUENCE public.sensitive_access_audit_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.sensitive_access_audit_id_seq FROM service_role;

GRANT INSERT, SELECT ON public.sensitive_access_audit TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.sensitive_access_audit_id_seq TO service_role;

-- -------------------------------------------------------------
-- Per-row bounds. NOT VALID avoids blocking rollout on legacy
-- rows while still enforcing the constraints for all new writes.
-- -------------------------------------------------------------
ALTER TABLE public.supermarkets DROP CONSTRAINT IF EXISTS supermarkets_security_bounds_check;
ALTER TABLE public.supermarkets ADD CONSTRAINT supermarkets_security_bounds_check CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 200
  AND (cnpj IS NULL OR char_length(cnpj) <= 18)
  AND (city IS NULL OR char_length(city) <= 120)
  AND (state IS NULL OR state ~ '^[A-Z]{2}$')
) NOT VALID;

ALTER TABLE public.drafts DROP CONSTRAINT IF EXISTS drafts_total_price_security_check;
ALTER TABLE public.drafts ADD CONSTRAINT drafts_total_price_security_check CHECK (
  total_price >= 0 AND total_price <= 99999999.99
) NOT VALID;

ALTER TABLE public.shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_security_bounds_check;
ALTER TABLE public.shopping_lists ADD CONSTRAINT shopping_lists_security_bounds_check CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 120
) NOT VALID;

ALTER TABLE public.shopping_list_items DROP CONSTRAINT IF EXISTS shopping_list_items_security_bounds_check;
ALTER TABLE public.shopping_list_items ADD CONSTRAINT shopping_list_items_security_bounds_check CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 200
  AND quantity > 0 AND quantity <= 99999
  AND char_length(unit) BETWEEN 1 AND 16
  AND estimated_price >= 0 AND estimated_price <= 99999999.99
) NOT VALID;

ALTER TABLE public.price_comparison_sessions DROP CONSTRAINT IF EXISTS price_comparison_sessions_security_bounds_check;
ALTER TABLE public.price_comparison_sessions ADD CONSTRAINT price_comparison_sessions_security_bounds_check CHECK (
  char_length(btrim(title)) BETWEEN 1 AND 200
  AND expires_at > created_at
) NOT VALID;

ALTER TABLE public.price_comparison_quotes DROP CONSTRAINT IF EXISTS price_comparison_quotes_security_bounds_check;
ALTER TABLE public.price_comparison_quotes ADD CONSTRAINT price_comparison_quotes_security_bounds_check CHECK (
  char_length(btrim(market_name_snapshot)) BETWEEN 1 AND 200
  AND (notes IS NULL OR char_length(notes) <= 5000)
  AND total_price >= 0 AND total_price <= 99999999.99
) NOT VALID;

ALTER TABLE public.price_comparison_quote_items DROP CONSTRAINT IF EXISTS price_comparison_quote_items_security_bounds_check;
ALTER TABLE public.price_comparison_quote_items ADD CONSTRAINT price_comparison_quote_items_security_bounds_check CHECK (
  char_length(btrim(name)) BETWEEN 1 AND 200
  AND (normalized_name IS NULL OR char_length(normalized_name) <= 200)
  AND quantity > 0 AND quantity <= 99999
  AND char_length(unit) BETWEEN 1 AND 16
  AND price >= 0 AND price <= 99999999.99
) NOT VALID;

ALTER TABLE public.sensitive_access_audit DROP CONSTRAINT IF EXISTS sensitive_access_audit_security_bounds_check;
ALTER TABLE public.sensitive_access_audit ADD CONSTRAINT sensitive_access_audit_security_bounds_check CHECK (
  char_length(actor) BETWEEN 1 AND 200
  AND char_length(action) BETWEEN 1 AND 200
  AND (justification IS NULL OR char_length(justification) <= 2000)
  AND (target_table IS NULL OR char_length(target_table) <= 200)
  AND (approved_by IS NULL OR char_length(approved_by) <= 200)
  AND (row_count IS NULL OR row_count >= 0)
) NOT VALID;

-- -------------------------------------------------------------
-- Row quotas. These are last-line database guardrails.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_owned_row_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
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

REVOKE ALL ON FUNCTION public.enforce_owned_row_quota() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_supermarkets_owned_row_quota ON public.supermarkets;
CREATE TRIGGER enforce_supermarkets_owned_row_quota
  BEFORE INSERT ON public.supermarkets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_row_quota();

DROP TRIGGER IF EXISTS enforce_purchases_owned_row_quota ON public.purchases;
CREATE TRIGGER enforce_purchases_owned_row_quota
  BEFORE INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_row_quota();

DROP TRIGGER IF EXISTS enforce_drafts_owned_row_quota ON public.drafts;
CREATE TRIGGER enforce_drafts_owned_row_quota
  BEFORE INSERT ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_row_quota();

DROP TRIGGER IF EXISTS enforce_shopping_lists_owned_row_quota ON public.shopping_lists;
CREATE TRIGGER enforce_shopping_lists_owned_row_quota
  BEFORE INSERT ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_row_quota();

DROP TRIGGER IF EXISTS enforce_price_comparison_sessions_owned_row_quota ON public.price_comparison_sessions;
CREATE TRIGGER enforce_price_comparison_sessions_owned_row_quota
  BEFORE INSERT ON public.price_comparison_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_row_quota();

DROP TRIGGER IF EXISTS enforce_learned_reclassifications_owned_row_quota ON public.learned_reclassifications;
CREATE TRIGGER enforce_learned_reclassifications_owned_row_quota
  BEFORE INSERT ON public.learned_reclassifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owned_row_quota();

-- -------------------------------------------------------------
-- Authenticated write rate limits. Counters live outside exposed schemas
-- and are updated atomically to remain effective under concurrency.
-- Gateway/IP limits are still recommended for unauthenticated endpoints.
-- -------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.authenticated_write_rate_limits (
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  PRIMARY KEY (user_id, action)
);

ALTER TABLE private.authenticated_write_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.authenticated_write_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.enforce_authenticated_write_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, private
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_action TEXT := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || ':' || TG_OP;
  v_max_requests INTEGER;
  v_now TIMESTAMPTZ := statement_timestamp();
  v_request_count INTEGER;
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

  INSERT INTO private.authenticated_write_rate_limits AS limits (
    user_id,
    action,
    window_started_at,
    request_count
  ) VALUES (
    v_user_id,
    v_action,
    v_now,
    1
  )
  ON CONFLICT (user_id, action) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= v_now - INTERVAL '1 hour' THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= v_now - INTERVAL '1 hour' THEN 1
      ELSE limits.request_count + 1
    END
  RETURNING request_count INTO v_request_count;

  IF v_request_count > v_max_requests THEN
    RAISE EXCEPTION 'Rate limit de % operacoes por hora excedido para %',
      v_max_requests,
      v_action
      USING ERRCODE = 'program_limit_exceeded';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_authenticated_write_rate_limit()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_supermarkets_write_rate_limit ON public.supermarkets;
CREATE TRIGGER enforce_supermarkets_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.supermarkets
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

DROP TRIGGER IF EXISTS enforce_purchases_write_rate_limit ON public.purchases;
CREATE TRIGGER enforce_purchases_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

DROP TRIGGER IF EXISTS enforce_drafts_write_rate_limit ON public.drafts;
CREATE TRIGGER enforce_drafts_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.drafts
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

DROP TRIGGER IF EXISTS enforce_shopping_lists_write_rate_limit ON public.shopping_lists;
CREATE TRIGGER enforce_shopping_lists_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

DROP TRIGGER IF EXISTS enforce_price_comparison_sessions_write_rate_limit
  ON public.price_comparison_sessions;
CREATE TRIGGER enforce_price_comparison_sessions_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.price_comparison_sessions
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

DROP TRIGGER IF EXISTS enforce_price_comparison_quotes_write_rate_limit
  ON public.price_comparison_quotes;
CREATE TRIGGER enforce_price_comparison_quotes_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.price_comparison_quotes
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

DROP TRIGGER IF EXISTS enforce_learned_reclassifications_write_rate_limit
  ON public.learned_reclassifications;
CREATE TRIGGER enforce_learned_reclassifications_write_rate_limit
  BEFORE INSERT OR UPDATE OR DELETE ON public.learned_reclassifications
  FOR EACH ROW EXECUTE FUNCTION private.enforce_authenticated_write_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_items_per_purchase_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.items i WHERE i.purchase_id = NEW.purchase_id) >= 300 THEN
    RAISE EXCEPTION 'Limite de 300 itens por compra excedido'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_items_per_purchase_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_items_per_purchase_limit ON public.items;
CREATE TRIGGER enforce_items_per_purchase_limit
  BEFORE INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_items_per_purchase_limit();

CREATE OR REPLACE FUNCTION public.enforce_shopping_list_items_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
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

REVOKE ALL ON FUNCTION public.enforce_shopping_list_items_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_shopping_list_items_limit ON public.shopping_list_items;
CREATE TRIGGER enforce_shopping_list_items_limit
  BEFORE INSERT ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shopping_list_items_limit();

CREATE OR REPLACE FUNCTION public.enforce_comparison_quotes_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
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

REVOKE ALL ON FUNCTION public.enforce_comparison_quotes_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_comparison_quotes_limit ON public.price_comparison_quotes;
CREATE TRIGGER enforce_comparison_quotes_limit
  BEFORE INSERT ON public.price_comparison_quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comparison_quotes_limit();

CREATE OR REPLACE FUNCTION public.enforce_comparison_quote_items_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
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

REVOKE ALL ON FUNCTION public.enforce_comparison_quote_items_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_comparison_quote_items_limit ON public.price_comparison_quote_items;
CREATE TRIGGER enforce_comparison_quote_items_limit
  BEFORE INSERT ON public.price_comparison_quote_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comparison_quote_items_limit();

-- Bound RPC inputs that otherwise multiply database work per request.
CREATE OR REPLACE FUNCTION public.get_items_average_prices_bulk(p_item_names TEXT[])
RETURNS TABLE(item_name TEXT, avg_price NUMERIC)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
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

REVOKE EXECUTE ON FUNCTION public.get_items_average_prices_bulk(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_items_average_prices_bulk(TEXT[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_top_items(
  p_limit INTEGER DEFAULT 10,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE(name TEXT, quantity NUMERIC, total NUMERIC)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
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

REVOKE EXECUTE ON FUNCTION public.report_top_items(INTEGER, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_top_items(INTEGER, DATE, DATE) TO authenticated, service_role;

COMMIT;
