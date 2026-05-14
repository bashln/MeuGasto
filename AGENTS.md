# Agent Rules — MeuGasto

## Invariants (NEVER change without explicit user confirmation)

### EAS Project ID
- `mobile/app.json` → `extra.eas.projectId` is permanently tied to installed APKs
- **Never modify this value.** Changing it breaks OTA updates for all existing installs
- Users must reinstall the APK manually to recover — there is no automatic fallback
- If EAS project migration is truly needed, flag it explicitly and warn the user before touching this field

### Android signing
- `mobile/app.json` → `android.package` (`com.prati.meugasto`) must never change after first install
- Keystore secrets (`ANDROID_KEYSTORE_*`) must never be rotated without a full release plan

### Version codes
- `android.versionCode` and `ios.buildNumber` must always increment — never decrement or reuse
- Keep in sync with `version` in `app.json`

## Branch rules
- `main` branch is protected — never push directly, never force push
- All changes go through `dev` → PR → `main`

## Distribution model
- Android: signed APK via GitHub Releases (tag `v*` triggers `release.yml`)
- OTA updates: EAS Update via `ota-update.yml` (dev → preview channel, main → production channel)
- No Google Play, no TestFlight
