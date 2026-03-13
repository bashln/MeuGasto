#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/android-build-release-local.sh           # incremental build
#   bash scripts/android-build-release-local.sh --clean   # full prebuild + build

cd "$(dirname "$0")/.."

# ── Load .env ────────────────────────────────────────────────────────────────
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
fi

# ── Validate required vars ────────────────────────────────────────────────────
: "${EXPO_PUBLIC_SUPABASE_URL:?Missing EXPO_PUBLIC_SUPABASE_URL in .env}"
: "${EXPO_PUBLIC_SUPABASE_ANON_KEY:?Missing EXPO_PUBLIC_SUPABASE_ANON_KEY in .env}"
: "${MEUGASTO_STORE_FILE:?Missing MEUGASTO_STORE_FILE in .env}"
: "${MEUGASTO_STORE_PASSWORD:?Missing MEUGASTO_STORE_PASSWORD in .env}"
: "${MEUGASTO_KEY_ALIAS:?Missing MEUGASTO_KEY_ALIAS in .env}"
: "${MEUGASTO_KEY_PASSWORD:?Missing MEUGASTO_KEY_PASSWORD in .env}"

case "$EXPO_PUBLIC_SUPABASE_URL" in
  https://*) ;;
  *) echo "ERROR: EXPO_PUBLIC_SUPABASE_URL must start with https://"; exit 1 ;;
esac

# ── Parse flags ───────────────────────────────────────────────────────────────
CLEAN=false
for arg in "$@"; do
  case "$arg" in
    --clean) CLEAN=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── expo prebuild ─────────────────────────────────────────────────────────────
if [[ "$CLEAN" == true ]]; then
  echo "Running expo prebuild --clean ..."
  npx expo prebuild --clean --platform android
elif [[ ! -d android ]]; then
  echo "android/ not found, running expo prebuild ..."
  npx expo prebuild --platform android
else
  echo "android/ exists — skipping prebuild (use --clean to regenerate)"
fi

# ── Gradle build ──────────────────────────────────────────────────────────────
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

# ── Report APK location ───────────────────────────────────────────────────────
APK_PATH="app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK_PATH" ]]; then
  echo ""
  echo "Build complete."
  echo "APK: $(pwd)/$APK_PATH"
else
  echo "ERROR: APK not found at $(pwd)/$APK_PATH"
  exit 1
fi
