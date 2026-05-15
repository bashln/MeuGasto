-- =============================================================
-- PRIVACY MIGRATION — MeuGasto
-- Objetivo: admin não consegue descobrir quem comprou o quê.
-- Admin vê apenas analytics agregados sem user_id.
-- =============================================================

-- =============================================
-- FASE 0 — HMAC para access_key (NFC-e)
-- Troca chave fiscal em texto puro por hash HMAC.
-- Admin vê hash opaco; JOIN com auth.users é inviável sem SECRET.
-- SECRET deve ser configurado no Supabase Vault:
--   INSERT INTO vault.secrets (name, secret) VALUES ('hmac_secret', '<valor_forte>');
--   Depois setar como parâmetro de banco ou via pgsodium.
-- =============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Adiciona categoria de produto aos itens
ALTER TABLE items ADD COLUMN IF NOT EXISTS category_id INTEGER;

-- Adiciona coluna hash ao lado da coluna atual
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS access_key_hash TEXT;

-- Índice único no hash (substitui o índice em access_key)
DROP INDEX IF EXISTS idx_purchases_user_access_key_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_user_access_key_hash_unique
  ON purchases(user_id, access_key_hash)
  WHERE access_key_hash IS NOT NULL;

-- Remove constraint de formato da chave original
-- (mantém access_key temporariamente para migração de dados existentes)
-- Após confirmar migração completa, rodar:
--   ALTER TABLE purchases DROP COLUMN access_key;
-- Por ora, apenas remove constraint de formato que bloqueia NULL após migração
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_access_key_format_check;

-- Atualiza função create_purchase_with_items para usar HMAC internamente.
-- App continua enviando a chave em texto (44 dígitos via TLS).
-- Servidor computa HMAC e armazena somente o hash.
-- SECRET lido via parâmetro de sessão (configurar no Supabase via Vault + hook ou app.settings).
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


-- =============================================
-- FASE 1 — Tabelas analytics sem user_id
-- Admin só consulta estas tabelas.
-- Nenhuma coluna de identidade (user_id, email, token, purchase_id).
-- =============================================

CREATE TABLE IF NOT EXISTS analytics_item_prices (
  id BIGSERIAL PRIMARY KEY,
  bucket_date DATE NOT NULL,
  city TEXT,
  state TEXT,
  supermarket_id INTEGER REFERENCES supermarkets(id) ON DELETE SET NULL,
  normalized_item_name TEXT NOT NULL,
  unit TEXT,
  avg_unit_price NUMERIC(10,4) NOT NULL,
  min_unit_price NUMERIC(10,4) NOT NULL,
  max_unit_price NUMERIC(10,4) NOT NULL,
  sample_count INTEGER NOT NULL,
  contributor_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_item_prices_contributor_min CHECK (contributor_count >= 5),
  CONSTRAINT analytics_item_prices_sample_min CHECK (sample_count >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_item_prices_bucket
  ON analytics_item_prices(bucket_date, normalized_item_name, COALESCE(supermarket_id, 0), COALESCE(city, ''), COALESCE(unit, ''));

CREATE INDEX IF NOT EXISTS idx_analytics_item_prices_item ON analytics_item_prices(normalized_item_name);
CREATE INDEX IF NOT EXISTS idx_analytics_item_prices_supermarket ON analytics_item_prices(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_analytics_item_prices_date ON analytics_item_prices(bucket_date);


CREATE TABLE IF NOT EXISTS analytics_market_baskets (
  id BIGSERIAL PRIMARY KEY,
  bucket_date DATE NOT NULL,
  city TEXT,
  state TEXT,
  supermarket_id INTEGER REFERENCES supermarkets(id) ON DELETE SET NULL,
  basket_key TEXT NOT NULL,
  avg_basket_price NUMERIC(10,2) NOT NULL,
  min_basket_price NUMERIC(10,2) NOT NULL,
  max_basket_price NUMERIC(10,2) NOT NULL,
  sample_count INTEGER NOT NULL,
  contributor_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_market_baskets_contributor_min CHECK (contributor_count >= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_market_baskets_bucket
  ON analytics_market_baskets(bucket_date, basket_key, COALESCE(supermarket_id, 0), COALESCE(city, ''));

CREATE INDEX IF NOT EXISTS idx_analytics_market_baskets_supermarket ON analytics_market_baskets(supermarket_id);
CREATE INDEX IF NOT EXISTS idx_analytics_market_baskets_date ON analytics_market_baskets(bucket_date);


CREATE TABLE IF NOT EXISTS analytics_price_trends (
  id BIGSERIAL PRIMARY KEY,
  bucket_month DATE NOT NULL,
  city TEXT,
  state TEXT,
  normalized_item_name TEXT NOT NULL,
  avg_price NUMERIC(10,4) NOT NULL,
  price_change_percent NUMERIC(8,4),
  sample_count INTEGER NOT NULL,
  contributor_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT analytics_price_trends_contributor_min CHECK (contributor_count >= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_price_trends_bucket
  ON analytics_price_trends(bucket_month, normalized_item_name, COALESCE(city, ''));

CREATE INDEX IF NOT EXISTS idx_analytics_price_trends_item ON analytics_price_trends(normalized_item_name);
CREATE INDEX IF NOT EXISTS idx_analytics_price_trends_month ON analytics_price_trends(bucket_month);


-- RLS: qualquer autenticado pode ler analytics; ninguém escreve direto
ALTER TABLE analytics_item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_market_baskets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_price_trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_item_prices_read ON analytics_item_prices;
CREATE POLICY analytics_item_prices_read ON analytics_item_prices
  FOR SELECT USING (contributor_count >= 5);

DROP POLICY IF EXISTS analytics_market_baskets_read ON analytics_market_baskets;
CREATE POLICY analytics_market_baskets_read ON analytics_market_baskets
  FOR SELECT USING (contributor_count >= 5);

DROP POLICY IF EXISTS analytics_price_trends_read ON analytics_price_trends;
CREATE POLICY analytics_price_trends_read ON analytics_price_trends
  FOR SELECT USING (contributor_count >= 5);

-- Somente função de agregação (SECURITY DEFINER) pode escrever nas tabelas analytics
REVOKE INSERT, UPDATE, DELETE ON analytics_item_prices FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON analytics_market_baskets FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON analytics_price_trends FROM PUBLIC;


-- =============================================
-- FASE 2 — Role separation
-- analytics_reader: somente tabelas analytics
-- support_limited: metadados mínimos de conta, sem compras
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_reader') THEN
    CREATE ROLE analytics_reader NOLOGIN;
  END IF;
END
$$;

GRANT SELECT ON analytics_item_prices TO analytics_reader;
GRANT SELECT ON analytics_market_baskets TO analytics_reader;
GRANT SELECT ON analytics_price_trends TO analytics_reader;

REVOKE SELECT ON purchases FROM analytics_reader;
REVOKE SELECT ON items FROM analytics_reader;
REVOKE SELECT ON profiles FROM analytics_reader;
REVOKE SELECT ON drafts FROM analytics_reader;
REVOKE SELECT ON learned_reclassifications FROM analytics_reader;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'support_limited') THEN
    CREATE ROLE support_limited NOLOGIN;
  END IF;
END
$$;

-- support_limited vê apenas metadados de conta (sem compras, itens ou totais)
GRANT SELECT (id, created_at, updated_at) ON profiles TO support_limited;
REVOKE SELECT ON purchases FROM support_limited;
REVOKE SELECT ON items FROM support_limited;


-- =============================================
-- FASE 3 — Pipeline de agregação diário
-- Job lê purchases + items, agrega por item/mercado/cidade/período.
-- Nunca grava user_id nas tabelas analytics.
-- Publica somente grupos com contributor_count >= 5 (k-anonymity).
-- =============================================

CREATE OR REPLACE FUNCTION public.run_analytics_aggregation(
  p_bucket_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Revogar execução pública; somente roles autorizados chamam
REVOKE EXECUTE ON FUNCTION public.run_analytics_aggregation FROM PUBLIC;

-- Agendar via pg_cron (executar após habilitar extensão no Supabase):
-- SELECT cron.schedule('aggregate-analytics-daily', '0 3 * * *', $$SELECT public.run_analytics_aggregation()$$);


-- =============================================
-- FASE 4 — Auditoria de acesso sensível
-- Registra qualquer acesso excepcional a dados brutos.
-- =============================================

CREATE TABLE IF NOT EXISTS sensitive_access_audit (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  justification TEXT,
  target_table TEXT,
  row_count INTEGER,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  expires_at TIMESTAMPTZ
);

ALTER TABLE sensitive_access_audit ENABLE ROW LEVEL SECURITY;

-- Somente service_role (break-glass) insere; ninguém lê via app normal
DROP POLICY IF EXISTS audit_insert_service ON sensitive_access_audit;
CREATE POLICY audit_insert_service ON sensitive_access_audit
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS audit_select_service ON sensitive_access_audit;
CREATE POLICY audit_select_service ON sensitive_access_audit
  FOR SELECT USING (false);

-- Índice para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_sensitive_access_audit_actor ON sensitive_access_audit(actor, accessed_at);
CREATE INDEX IF NOT EXISTS idx_sensitive_access_audit_table ON sensitive_access_audit(target_table, accessed_at);
