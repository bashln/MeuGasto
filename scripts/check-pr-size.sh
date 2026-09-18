#!/usr/bin/env bash

set -euo pipefail

changed_files="${1:-}"
additions="${2:-}"
deletions="${3:-}"

for value in "$changed_files" "$additions" "$deletions"; do
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    echo "ERROR: PR size values must be non-negative integers" >&2
    exit 1
  fi
done

max_files=30
max_changed_lines=1000
changed_lines=$((additions + deletions))

if ((changed_files <= max_files && changed_lines <= max_changed_lines)); then
  echo "PR size OK: ${changed_files} files, ${changed_lines} changed lines."
  exit 0
fi

message="PR grande: ${changed_files} arquivos e ${changed_lines} linhas alteradas. Prefira PRs com ate ${max_files} arquivos e ${max_changed_lines} linhas, ou justifique o escopo."
echo "::warning title=Pull request size::${message}"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Aviso de tamanho da PR"
    echo
    echo "$message"
  } >> "$GITHUB_STEP_SUMMARY"
fi
