#!/usr/bin/env bash
# Guardrail CI: falha se tabelas analytics_* receberem user_id, purchase_id ou identificadores pessoais.
# Rodar antes de aplicar migrations ou em CI.

set -euo pipefail

FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
HARDENING_MIGRATION='mobile/supabase_security_hardening_migration.sql'

check_file() {
  local file="$1"
  local context="$2"

  # Proibido em tabelas analytics: user_id, purchase_id, email, token pessoal
  local forbidden_patterns=(
    'analytics[^;]*user_id'
    'analytics[^;]*purchase_id'
    'analytics[^;]*\bemail\b'
    'analytics[^;]*account_id'
  )

  for pattern in "${forbidden_patterns[@]}"; do
    # Ignorar linhas de comentário SQL (-- ...) e comentários de bloco
    if grep -iP "$pattern" "$file" 2>/dev/null | grep -vP '^\s*--' | grep -q .; then
      echo -e "${RED}FAIL${NC}: '$pattern' encontrado em tabela analytics — $context ($file)"
      FAIL=1
    fi
  done
}

require_hardening_pattern() {
  local pattern="$1"
  local description="$2"

  if ! grep -qP "$pattern" "$HARDENING_MIGRATION" 2>/dev/null; then
    echo -e "${RED}FAIL${NC}: hardening ausente — $description"
    FAIL=1
  fi
}

# Verificar schema principal
if [[ -f "mobile/supabase_schema.sql" ]]; then
  check_file "mobile/supabase_schema.sql" "schema principal"
fi

# Verificar migration de privacidade
if [[ -f "mobile/supabase_privacy_migration.sql" ]]; then
  check_file "mobile/supabase_privacy_migration.sql" "migration"
fi

if ls mobile/supabase_migrations/*.sql > /dev/null 2>&1; then
  for f in mobile/supabase_migrations/*.sql; do
    check_file "$f" "migration"
  done
fi

# Verificar que access_key em texto puro não está sendo armazenada (deve usar access_key_hash)
# Busca especificamente o padrão de mapeamento "purchase.access_key" sem _hash
if grep -n "purchase\.access_key[^_]" mobile/src/services/purchaseService.ts 2>/dev/null | grep -q .; then
  echo -e "${RED}FAIL${NC}: purchaseService.ts mapeando access_key em texto puro — deve usar access_key_hash"
  FAIL=1
fi

# Verificar que nfceService não retorna access_key no resultado de createPurchaseFromScrapedData
if grep -A5 "return {" mobile/src/services/nfceService.ts 2>/dev/null | grep -q "accessKey:.*sanitizedAccessKey"; then
  echo -e "${RED}FAIL${NC}: nfceService.ts retornando access_key em texto puro"
  FAIL=1
fi

# Verificar controles que impedem inferência por Sybil, escrita em auditoria e
# exposição acidental das tabelas agregadas pelo cliente público.
if [[ ! -f "$HARDENING_MIGRATION" ]]; then
  echo -e "${RED}FAIL${NC}: migration de hardening não encontrada ($HARDENING_MIGRATION)"
  FAIL=1
else
  require_hardening_pattern 'can_reference_supermarket' 'referências de supermercado devem respeitar ownership'
  for analytics_table in analytics_item_prices analytics_market_baskets analytics_price_trends; do
    require_hardening_pattern "REVOKE SELECT, INSERT, UPDATE, DELETE ON public\\.${analytics_table} FROM PUBLIC, anon, authenticated" "${analytics_table} não deve ser legível por anon/authenticated"
  done
  require_hardening_pattern 'FOR SELECT TO analytics_reader' 'analytics deve ser restrito à role agregadora'
  require_hardening_pattern 'REVOKE ALL ON public\.sensitive_access_audit FROM PUBLIC, anon, authenticated' 'clientes não devem escrever no log de auditoria'
  require_hardening_pattern 'enforce_items_per_purchase_limit' 'compras precisam limitar itens mesmo fora do RPC'
  require_hardening_pattern 'enforce_owned_row_quota' 'tabelas por usuário precisam de quota defensiva'
  require_hardening_pattern 'CREATE SCHEMA IF NOT EXISTS private' 'contadores de rate limit devem ficar fora do schema exposto'
  require_hardening_pattern 'private\.authenticated_write_rate_limits' 'escritas autenticadas precisam de contadores atomicos'
  require_hardening_pattern 'enforce_authenticated_write_rate_limit' 'escritas autenticadas precisam de rate limit no banco'
  require_hardening_pattern 'REVOKE ALL ON FUNCTION private\.enforce_authenticated_write_rate_limit' 'função privilegiada de rate limit não pode ser chamada pelo cliente'
fi

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}OK${NC}: Guardrails de privacidade e hardening verificados."
fi

exit $FAIL
