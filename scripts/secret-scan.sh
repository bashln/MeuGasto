#!/usr/bin/env bash

set -euo pipefail

SECRET_PATTERN='sk_(live|test)_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----'

if matches="$(git grep -IlE "$SECRET_PATTERN" -- ':!scripts/secret-scan.sh' || true)" && [[ -n "$matches" ]]; then
  echo "FAIL: possible credential format found in tracked files:" >&2
  printf '%s\n' "$matches" >&2
  exit 1
fi

if git --no-pager log --all -p --format= -- . ':(exclude)scripts/secret-scan.sh' | LC_ALL=C grep -aE "$SECRET_PATTERN" > /dev/null; then
  echo "FAIL: possible credential format found in Git history." >&2
  exit 1
fi

echo "OK: no known credential formats found in tracked files or Git history."
