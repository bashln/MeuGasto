#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARD="$SCRIPT_DIR/repo-hygiene-check.sh"

FIXTURES=()
FAILED=0

cleanup() {
  if (( ${#FIXTURES[@]} == 0 )); then
    return 0
  fi
  rm -rf -- "${FIXTURES[@]}"
}
trap cleanup EXIT

make_fixture() {
  local dir

  dir="$(mktemp -d)"
  FIXTURES+=("$dir")
  git -C "$dir" init -q
  git -C "$dir" config user.email "fixture@example.invalid"
  git -C "$dir" config user.name "fixture"
  printf '%s\n' "$dir"
}

expect() {
  local name="$1"
  local expected_status="$2"
  local fixture="$3"
  local expected_text="$4"
  local status=0 output

  output="$(REPO_ROOT="$fixture" bash "$GUARD" 2>&1)" || status=$?

  if (( status != expected_status )); then
    printf 'FAIL %s (exit %s, expected %s)\n%s\n' "$name" "$status" "$expected_status" "$output"
    FAILED=1
    return 0
  fi

  if [[ "$output" != *"$expected_text"* ]]; then
    printf 'FAIL %s (exit %s, output missing "%s")\n%s\n' "$name" "$status" "$expected_text" "$output"
    FAILED=1
    return 0
  fi

  printf 'PASS %s (exit %s)\n' "$name" "$status"
}

fixture="$(make_fixture)"
printf '# Fixture\n' > "$fixture/README.md"
git -C "$fixture" add -A
expect 'clean repository passes' 0 "$fixture" 'OK: repository hygiene verified.'

fixture="$(make_fixture)"
mkdir -p "$fixture/supabase/.temp"
printf 'fixture-project-ref\n' > "$fixture/supabase/.temp/project-ref"
git -C "$fixture" add -A
expect 'tracked supabase temp artifact fails' 1 "$fixture" \
  'FAIL: tracked local artifact: supabase/.temp/project-ref'

fixture="$(make_fixture)"
printf 'APP_KEY=placeholder\n' > "$fixture/.env"
git -C "$fixture" add -A
expect 'tracked .env fails' 1 "$fixture" 'FAIL: tracked secret-bearing file: .env'

fixture="$(make_fixture)"
printf 'APP_KEY=placeholder\n' > "$fixture/.env.example"
git -C "$fixture" add -A
expect 'tracked .env.example passes' 0 "$fixture" 'OK: repository hygiene verified.'

fixture="$(make_fixture)"
project_host="$(printf 'a%.0s' {1..20})"
printf 'endpoint: https://%s.supabase.co\n' "$project_host" > "$fixture/endpoints.md"
git -C "$fixture" add -A
expect 'tracked real supabase project URL fails' 1 "$fixture" \
  'FAIL: real Supabase project URL: endpoints.md:1'

fixture="$(make_fixture)"
cpf_value="$(printf '%s.%s.%s-%s' '123' '456' '789' '00')"
printf 'document: %s\n' "$cpf_value" > "$fixture/notes.md"
git -C "$fixture" add -A
expect 'tracked CPF-shaped value fails' 1 "$fixture" 'FAIL: CPF-shaped value: notes.md:1'

if (( FAILED != 0 )); then
  exit 1
fi

printf 'All repository hygiene cases passed.\n'
