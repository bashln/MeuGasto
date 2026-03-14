#!/usr/bin/env bash
#
# Build debug APK for Android
#
# IMPORTANTE: Este script requer que o arquivo .env esteja presente no diretório mobile/
# com as seguintes variáveis definidas:
#   - EXPO_PUBLIC_SUPABASE_URL
#   - EXPO_PUBLIC_SUPABASE_ANON_KEY
#
# Estas variáveis são necessárias para:
#   1. O expo prebuild gerar o APK com os valores corretos
#   2. A splash screen carregar corretamente
#   3. O app conectar com o Supabase
#
# Usage:
#   bash scripts/android-build-debug-device.sh
#
# Este APK e apenas para desenvolvimento local com Metro ativo.
# Para teste standalone no aparelho, gere um APK release.
#

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Load .env (OBRIGATÓRIO) ─────────────────────────────────────────────────
if [[ -f .env ]]; then
	set -a
	# shellcheck disable=SC1091
	source ./.env
	set +a
else
	echo "ERROR: .env file not found!"
	echo ""
	echo "Crie o arquivo .env no diretório mobile/ com as seguintes variáveis:"
	echo "  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
	echo "  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
	echo ""
	echo "Consulte o arquivo .env.example para参考."
	exit 1
fi

# ── Validate required vars ────────────────────────────────────────────────────
: "${EXPO_PUBLIC_SUPABASE_URL:?Missing EXPO_PUBLIC_SUPABASE_URL in .env}"
: "${EXPO_PUBLIC_SUPABASE_ANON_KEY:?Missing EXPO_PUBLIC_SUPABASE_ANON_KEY in .env}"

# ── expo prebuild ─────────────────────────────────────────────────────────────
# IMPORTANTE: O diretório android/ precisa ser regenerado se as variáveis mudarem.
# Sempre remova android/ quando precisar garantir que as variáveis estão corretas.
if [[ ! -d android ]]; then
	echo "android/ not found, running expo prebuild ..."
	npx expo prebuild --platform android
else
	echo "android/ exists — skipping prebuild"
	echo "⚠️  NOTE: If you changed .env, remove android/ and rebuild to regenerate with new values"
fi

# ── Configure Android SDK path ───────────────────────────────────────────────
# O SDK está em /home/bashln/Android/Sdk (não em /home/bashln/Android)
if [[ ! -f android/local.properties ]]; then
	echo "sdk.dir=/home/bashln/Android/Sdk" >android/local.properties
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

echo ""
echo "APK gerado em: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "Proximos passos para usar o DEBUG APK:"
echo "  1. Em outro terminal: npm start"
echo "  2. Execute: adb reverse tcp:8081 tcp:8081"
echo "  3. Instale/abra o app"
echo ""
echo "Se voce quer testar sem Metro, use o build release:"
echo "  bash scripts/android-build-release-local.sh"
