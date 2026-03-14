#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! adb get-state >/dev/null 2>&1; then
	echo "ERROR: no Android device detected via adb"
	exit 1
fi

bash scripts/android-build-release-local.sh "$@"
bash scripts/android-install-release-local.sh

adb shell monkey -p com.prati.meugasto -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

echo ""
echo "Release test flow completed."
echo "The standalone APK was built, installed, and launched."
