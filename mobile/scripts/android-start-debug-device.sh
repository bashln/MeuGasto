#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! adb get-state >/dev/null 2>&1; then
	echo "ERROR: no Android device detected via adb"
	exit 1
fi

adb reverse tcp:8081 tcp:8081

echo "adb reverse configured for tcp:8081"
echo "Starting Expo dev client server..."

exec npx expo start --dev-client
