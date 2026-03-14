#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
PACKAGE_NAME="com.prati.meugasto"
METRO_STATUS_URL="http://127.0.0.1:8081/status"

if [[ ! -f "$APK_PATH" ]]; then
	echo "ERROR: debug APK not found at $APK_PATH"
	echo "Generate it first with: bash scripts/android-build-debug-device.sh"
	exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
	echo "ERROR: no Android device detected via adb"
	exit 1
fi

if ! adb reverse --list 2>/dev/null | grep -q 'tcp:8081.*tcp:8081'; then
	echo "ERROR: adb reverse for Metro is not configured"
	echo "Run: adb reverse tcp:8081 tcp:8081"
	exit 1
fi

if ! curl -fsS "$METRO_STATUS_URL" 2>/dev/null | grep -q 'packager-status:running'; then
	echo "ERROR: Metro is not running on localhost:8081"
	echo "Start it with: bash scripts/android-start-debug-device.sh"
	exit 1
fi

adb uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
adb install "$APK_PATH"

echo ""
echo "Debug APK installed successfully."
echo "Metro and adb reverse are active, so the app can load the JS bundle."
