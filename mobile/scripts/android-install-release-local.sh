#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

APP_VERSION="$(node -p "require('./app.json').expo.version")"
APK_PATH="android/app/build/outputs/apk/release/MeuGastov${APP_VERSION}.apk"

if [[ ! -f "$APK_PATH" ]]; then
	echo "ERROR: release APK not found at $APK_PATH"
	echo "Generate it first with: bash scripts/android-build-release-local.sh"
	exit 1
fi

adb uninstall com.prati.meugasto >/dev/null 2>&1 || true
adb install "$APK_PATH"

echo ""
echo "Release APK installed successfully."
echo "This build is standalone and does not require Metro."
