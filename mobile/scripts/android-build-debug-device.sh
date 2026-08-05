#!/usr/bin/env bash
set +x
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" ]]; then
  MISE_JAVA_HOME=""
  if command -v mise > /dev/null 2>&1; then
    MISE_JAVA_HOME="$(mise where java@17 2>/dev/null || true)"
  fi

  if [[ -n "$MISE_JAVA_HOME" && -x "$MISE_JAVA_HOME/bin/java" ]]; then
    JAVA_HOME="$MISE_JAVA_HOME"
  else
    JAVA_HOME="$(java -XshowSettings:properties -version 2>&1 | awk -F'= ' '/java.home =/ { print $2; exit }')"
  fi
fi

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "ERROR: unable to resolve a valid JAVA_HOME" >&2
  exit 1
fi

export JAVA_HOME

if [[ ! -f android/gradlew || ! -f android/app/build.gradle ]]; then
  echo "Android project is missing or incomplete — running expo prebuild --clean ..."
  npx expo prebuild --clean --platform android
  echo "sdk.dir=${ANDROID_HOME:-$HOME/Android/Sdk}" > android/local.properties
fi

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
