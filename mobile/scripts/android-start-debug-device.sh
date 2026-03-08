#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

adb reverse tcp:8081 tcp:8081
exec npx expo start --dev-client
