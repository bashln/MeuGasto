#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"
export JAVA_HOME

cd android

./gradlew assembleDebug \
  --no-daemon \
  --parallel \
  --build-cache \
  -PreactNativeArchitectures=arm64-v8a \
  -PMEUGASTO_STORE_FILE=app/debug.keystore \
  -PMEUGASTO_STORE_PASSWORD=android \
  -PMEUGASTO_KEY_ALIAS=androiddebugkey \
  -PMEUGASTO_KEY_PASSWORD=android
