#!/usr/bin/env bash
# Guardrail CI: valida invariantes de privacidade, SQL hardening e seguranca do cliente Android.
# Rodar antes de aplicar migrations ou em CI.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
HARDENING_MIGRATION=''
for candidate in \
  'mobile/supabase_security_hardening_migration.sql' \
  'docs/supabase/supabase_security_hardening_migration.sql'; do
  if [[ -f "$candidate" ]]; then
    HARDENING_MIGRATION="$candidate"
    break
  fi
done

check_file() {
  local file="$1"
  local context="$2"

  local forbidden_patterns=(
    'analytics[^;]*user_id'
    'analytics[^;]*purchase_id'
    'analytics[^;]*\bemail\b'
    'analytics[^;]*account_id'
  )

  for pattern in "${forbidden_patterns[@]}"; do
    if grep -iP "$pattern" "$file" 2>/dev/null | grep -vP '^\s*--' | grep -q .; then
      echo -e "${RED}FAIL${NC}: '$pattern' encontrado em tabela analytics ($context: $file)"
      FAIL=1
    fi
  done
}

require_pattern_in_file() {
  local file="$1"
  local pattern="$2"
  local description="$3"

  if [[ ! -f "$file" ]] || ! grep -qP "$pattern" "$file" 2>/dev/null; then
    echo -e "${RED}FAIL${NC}: controle ausente em $file ($description)"
    FAIL=1
  fi
}

require_hardening_pattern() {
  local pattern="$1"
  local description="$2"

  require_pattern_in_file "$HARDENING_MIGRATION" "$pattern" "$description"
}

for sql_dir in "docs/supabase" "supabase/migrations" "mobile/supabase_migrations"; do
  if [[ -d "$sql_dir" ]]; then
    for f in "$sql_dir"/*.sql; do
      [[ -e "$f" ]] || continue
      check_file "$f" "$sql_dir"
    done
  fi
done

for legacy_sql in "mobile/supabase_schema.sql" "mobile/supabase_privacy_migration.sql"; do
  if [[ -f "$legacy_sql" ]]; then
    check_file "$legacy_sql" "legacy sql"
  fi
done

LEGACY_RPC_REVOKE_MIGRATION="supabase/migrations/20260811120000_revoke_legacy_purchase_rpc_and_constraints.sql"
require_pattern_in_file \
  "$LEGACY_RPC_REVOKE_MIGRATION" \
  "to_regprocedure\('public\.create_purchase_with_items\(uuid,integer,text,date,numeric,boolean,jsonb\)'\)" \
  'sobrecarga legada de 7 argumentos precisa ser verificada por assinatura'
require_pattern_in_file \
  "$LEGACY_RPC_REVOKE_MIGRATION" \
  'DROP FUNCTION public\.create_purchase_with_items' \
  'sobrecarga legada de 7 argumentos precisa permanecer removida'
require_pattern_in_file \
  "$LEGACY_RPC_REVOKE_MIGRATION" \
  'purchases_no_plaintext_access_key_check' \
  'constraint contra chave NFC-e de 44 digitos em texto puro precisa existir'

if [[ -d "mobile/app/src/main/kotlin" ]]; then
  if grep -rn 'getSharedPreferences("meugasto_secure_fallback"' mobile/app/src/main/kotlin 2>/dev/null | grep -q .; then
    echo -e "${RED}FAIL${NC}: fallback de SharedPreferences em texto puro detectado em mobile/app/src/main/kotlin"
    FAIL=1
  fi

  if grep -rn "Simula sucesso" mobile/app/src/main/kotlin 2>/dev/null | grep -q .; then
    echo -e "${RED}FAIL${NC}: fluxo simulado de seguranca/autenticacao detectado em mobile/app/src/main/kotlin"
    FAIL=1
  fi
fi

ANDROID_MANIFEST="mobile/app/src/main/AndroidManifest.xml"
require_pattern_in_file \
  "$ANDROID_MANIFEST" \
  'android\.permission\.RECORD_AUDIO' \
  'manifest precisa declarar bloqueio explicito de RECORD_AUDIO'
require_pattern_in_file \
  "$ANDROID_MANIFEST" \
  'tools:node="remove"' \
  'RECORD_AUDIO deve permanecer com tools:node="remove"'

FILE_PATHS_XML="mobile/app/src/main/res/xml/file_paths.xml"
if [[ -f "$FILE_PATHS_XML" ]]; then
  if grep -qP 'path="\."' "$FILE_PATHS_XML" 2>/dev/null; then
    echo -e "${RED}FAIL${NC}: FileProvider nao pode expor raiz do cache (path=\".\") em $FILE_PATHS_XML"
    FAIL=1
  fi
  require_pattern_in_file \
    "$FILE_PATHS_XML" \
    'path="updates/"' \
    'FileProvider deve restringir compartilhamento ao subdiretorio updates/'
fi

if [[ -z "$HARDENING_MIGRATION" ]]; then
  echo -e "${RED}FAIL${NC}: migration de hardening nao encontrada (mobile/supabase_security_hardening_migration.sql ou docs/supabase/supabase_security_hardening_migration.sql)"
  FAIL=1
else
  require_hardening_pattern 'can_reference_supermarket' 'referencias de supermercado devem respeitar ownership'
  for analytics_table in analytics_item_prices analytics_market_baskets analytics_price_trends; do
    require_hardening_pattern "REVOKE SELECT, INSERT, UPDATE, DELETE ON public\\.${analytics_table} FROM PUBLIC, anon, authenticated" "${analytics_table} nao deve ser legivel por anon/authenticated"
  done
  require_hardening_pattern 'FOR SELECT TO analytics_reader' 'analytics deve ser restrito a role agregadora'
  require_hardening_pattern 'REVOKE ALL ON public\.sensitive_access_audit FROM PUBLIC, anon, authenticated' 'clientes nao devem escrever no log de auditoria'
  require_hardening_pattern 'enforce_items_per_purchase_limit' 'compras precisam limitar itens mesmo fora do RPC'
  require_hardening_pattern 'enforce_owned_row_quota' 'tabelas por usuario precisam de quota defensiva'
  require_hardening_pattern 'CREATE SCHEMA IF NOT EXISTS private' 'contadores de rate limit devem ficar fora do schema exposto'
  require_hardening_pattern 'private\.authenticated_write_rate_limits' 'escritas autenticadas precisam de contadores atomicos'
  require_hardening_pattern 'enforce_authenticated_write_rate_limit' 'escritas autenticadas precisam de rate limit no banco'
  require_hardening_pattern 'REVOKE ALL ON FUNCTION private\.enforce_authenticated_write_rate_limit' 'funcao privilegiada de rate limit nao pode ser chamada pelo cliente'
  require_hardening_pattern "'handle_new_user'" 'funcoes SECURITY DEFINER existentes precisam ser removidas da superficie RPC'
  require_hardening_pattern "'run_analytics_aggregation'" 'agregacao administrativa nao pode ficar exposta como RPC de cliente'
  require_hardening_pattern "'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated'" 'funcoes privilegiadas nao podem ser executadas por clientes'
  require_hardening_pattern "'ALTER FUNCTION %s SET search_path = pg_catalog, public'" 'funcoes publicas precisam de search_path imutavel'
fi

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}OK${NC}: Guardrails de privacidade e hardening verificados."
fi

exit $FAIL
