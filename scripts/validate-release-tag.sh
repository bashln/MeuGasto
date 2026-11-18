#!/usr/bin/env bash

set -euo pipefail

RELEASE_TAG="${1:-}"
APP_JSON_PATH="${2:-mobile/app.json}"

if [[ ! "$RELEASE_TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: release tag must match vX.Y.Z.W" >&2
  exit 1
fi

if [[ ! -f "$APP_JSON_PATH" ]]; then
  echo "ERROR: app.json not found at $APP_JSON_PATH" >&2
  exit 1
fi

APP_VERSION="$(node -e "const fs=require('fs'); const config=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(config.expo.version);" "$APP_JSON_PATH")"

if [[ "$RELEASE_TAG" != "v${APP_VERSION}" ]]; then
  echo "ERROR: release tag $RELEASE_TAG does not match app version v${APP_VERSION}" >&2
  exit 1
fi

echo "Release tag validated: $RELEASE_TAG"
