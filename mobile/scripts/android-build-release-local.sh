#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

: "${MEUGASTO_STORE_FILE:?Missing MEUGASTO_STORE_FILE}"
: "${MEUGASTO_STORE_PASSWORD:?Missing MEUGASTO_STORE_PASSWORD}"
: "${MEUGASTO_KEY_ALIAS:?Missing MEUGASTO_KEY_ALIAS}"
: "${MEUGASTO_KEY_PASSWORD:?Missing MEUGASTO_KEY_PASSWORD}"

JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export JAVA_HOME

cd android

./gradlew assembleRelease \
  --no-daemon \
  --parallel \
  --build-cache \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -PMEUGASTO_STORE_FILE="$MEUGASTO_STORE_FILE" \
  -PMEUGASTO_STORE_PASSWORD="$MEUGASTO_STORE_PASSWORD" \
  -PMEUGASTO_KEY_ALIAS="$MEUGASTO_KEY_ALIAS" \
  -PMEUGASTO_KEY_PASSWORD="$MEUGASTO_KEY_PASSWORD"
