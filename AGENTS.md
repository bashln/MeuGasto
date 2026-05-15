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
- All changes go through `dev` -> PR -> `testing` → PR → `main`
- `dev` é onde tudo o que está sendo construido ocorre, aqui é onde eu testo tudo.
- `testing` é onde os usuários da base de testes realizam os testes por aproximadamente 1 mês.
- `main` é o que recebe o conteúdo de `testing` após ~1 mês de testes bem sucedidos.

## Versioning

Format: `vMAJOR.MINOR.PATCH.BUILD`

| Segment | When to increment |
|---|---|
| **MAJOR** | Large architecture, identity, or compatibility changes. Only after alpha/beta period ends. Requires explicit approval from the project owner. |
| **MINOR** | New relevant features and capabilities. |
| **PATCH** | Bug fixes, refinements, and small improvements. |
| **BUILD** | Internal changes, technical builds, and adjustments with no direct functional impact. |

**Rule:** When a segment increments, all segments to its right reset to zero.

**Example:** `v1.4.2.15`

## Distribution model

- Android: signed APK via GitHub Releases (tag `v*` triggers `release.yml`)
- OTA updates: EAS Update via `ota-update.yml` (dev → preview channel, main → production channel)
- No Google Play, no TestFlight
