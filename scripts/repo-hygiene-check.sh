#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"

FORBIDDEN_PREFIXES=('supabase/.temp/' 'docs/worklog/' 'trash/')
SUPABASE_URL_PATTERN='https?://[a-z0-9]{20}\.supabase\.co'
CPF_PATTERN='[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}'

STATUS=0

fail() {
  printf 'FAIL: %s\n' "$*"
  STATUS=1
}

require_work_tree() {
  if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]]; then
    printf 'ERROR: %s is not inside a Git work tree.\n' "$REPO_ROOT" >&2
    exit 1
  fi
}

check_forbidden_paths() {
  local path prefix

  for path in "${TRACKED_FILES[@]}"; do
    for prefix in "${FORBIDDEN_PREFIXES[@]}"; do
      if [[ "$path" == "$prefix"* ]]; then
        fail "tracked local artifact: $path"
      fi
    done
  done
}

check_secret_files() {
  local path base

  for path in "${TRACKED_FILES[@]}"; do
    base="${path##*/}"
    case "$base" in
      .env|local.properties|*.jks|*.keystore|*.p12|*.pem|*.db|*.db-journal|*.sqlite|*.sqlite3)
        fail "tracked secret-bearing file: $path"
        ;;
    esac
  done
}

check_contents() {
  local pattern="$1"
  local label="$2"
  local output status=0 file lineno rest

  if (( ${#TRACKED_FILES[@]} == 0 )); then
    return 0
  fi

  output="$(git grep -InE "$pattern" || status=$?)"

  case "$status" in
    0) ;;
    1) return 0 ;;
    *)
      printf 'ERROR: content scan failed for %s (git grep exit %s).\n' "$label" "$status" >&2
      exit 1
      ;;
  esac

  if [[ -z "$output" ]]; then
    return 0
  fi

  while IFS=: read -r file lineno rest; do
    fail "$label: $file:$lineno"
  done <<< "$output"
}

require_work_tree
mapfile -t TRACKED_FILES < <(git ls-files)

check_forbidden_paths
check_secret_files
check_contents "$SUPABASE_URL_PATTERN" 'real Supabase project URL'
check_contents "$CPF_PATTERN" 'CPF-shaped value'

if (( STATUS != 0 )); then
  exit 1
fi

printf 'OK: repository hygiene verified.\n'
