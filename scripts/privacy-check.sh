#!/usr/bin/env bash
# Guardrail CI: falha se tabelas analytics_* receberem user_id, purchase_id ou identificadores pessoais.
# Rodar antes de aplicar migrations ou em CI.

set -euo pipefail

FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

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

# Verificar schema principal
if [[ -f "mobile/supabase_schema.sql" ]]; then
  check_file "mobile/supabase_schema.sql" "schema principal"
fi

# Verificar arquivos de migration
for f in mobile/supabase_privacy_migration.sql; do
  [[ -f "$f" ]] && check_file "$f" "migration"
done

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

if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}OK${NC}: Nenhuma violação de privacidade detectada."
fi

exit $FAIL
