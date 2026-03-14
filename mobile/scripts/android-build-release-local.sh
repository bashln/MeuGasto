#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/android-build-release-local.sh           # incremental build
#   bash scripts/android-build-release-local.sh --clean   # full prebuild + build

cd "$(dirname "$0")/.."

APP_VERSION="$(node -p "require('./app.json').expo.version")"
APK_DIR="android/app/build/outputs/apk/release"
APK_SOURCE_PATH="$APK_DIR/app-release.apk"
APK_NAMED_PATH="$APK_DIR/MeuGastov${APP_VERSION}.apk"

# ── Load .env ────────────────────────────────────────────────────────────────
if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source ./.env
	set +a
else
	echo "ERROR: .env file not found!"
	echo "Create mobile/.env before building a release APK."
	exit 1
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
*)
	echo "ERROR: EXPO_PUBLIC_SUPABASE_URL must start with https://"
	exit 1
	;;
esac

case "$MEUGASTO_STORE_FILE" in
~/*) MEUGASTO_STORE_FILE="${HOME}/${MEUGASTO_STORE_FILE#~/}" ;;
esac

if [[ "$MEUGASTO_STORE_FILE" != /* ]]; then
	MEUGASTO_STORE_FILE="$(pwd)/android/app/$MEUGASTO_STORE_FILE"
fi

if [[ ! -f "$MEUGASTO_STORE_FILE" ]]; then
	echo "ERROR: keystore not found at $MEUGASTO_STORE_FILE"
	exit 1
fi

# ── Parse flags ───────────────────────────────────────────────────────────────
CLEAN=false
for arg in "$@"; do
	case "$arg" in
	--clean) CLEAN=true ;;
	*)
		echo "Unknown argument: $arg"
		exit 1
		;;
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

if [[ ! -f android/local.properties ]]; then
	# Achado auditor (mobile/scripts/android-build-release-local.sh): resolver sdk.dir dinamicamente sem hardcode.
	CANDIDATE_SDK_DIRS=(
		"${ANDROID_HOME:-}"
		"${ANDROID_SDK_ROOT:-}"
		"${HOME}/Android/Sdk"
		"${HOME}/Library/Android/sdk"
		"${HOME}/AppData/Local/Android/Sdk"
	)

	ANDROID_SDK_DIR=""
	for candidate in "${CANDIDATE_SDK_DIRS[@]}"; do
		if [[ -n "$candidate" && -d "$candidate" ]]; then
			ANDROID_SDK_DIR="$candidate"
			break
		fi
	done

	if [[ -z "$ANDROID_SDK_DIR" ]]; then
		echo "ERROR: Android SDK path not found."
		echo "Set ANDROID_HOME or ANDROID_SDK_ROOT, or install SDK under one of:"
		echo "  - $HOME/Android/Sdk"
		echo "  - $HOME/Library/Android/sdk"
		echo "  - $HOME/AppData/Local/Android/Sdk"
		exit 1
	fi

	printf 'sdk.dir=%s\n' "$ANDROID_SDK_DIR" >android/local.properties
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
if [[ -f "app/build/outputs/apk/release/app-release.apk" ]]; then
	cp "app/build/outputs/apk/release/app-release.apk" "app/build/outputs/apk/release/MeuGastov${APP_VERSION}.apk"
	APK_PATH="app/build/outputs/apk/release/MeuGastov${APP_VERSION}.apk"
	echo ""
	echo "Build complete."
	echo "APK: $(pwd)/$APK_PATH"
	echo "Standalone release APK ready for installation."
else
	echo "ERROR: APK not found at $(pwd)/app/build/outputs/apk/release/app-release.apk"
	exit 1
fi
