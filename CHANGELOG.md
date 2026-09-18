# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Release tags follow the project format `vMAJOR.MINOR.PATCH.BUILD`; GitHub Releases are the authoritative record of published APKs.

## [0.4.1.0] - 2026-09-18

### Added

- **Suporte a múltiplos tipos de estabelecimentos (#33)**: Leitura, registro e análise de compras em Farmácias, Postos de Combustível, Supermercados e outros varejistas.
- **Detecção automática de estabelecimentos**: Identificação inteligente de tipo por palavras-chave na Razão Social / Nome Fantasia (`EstablishmentDetector`).
- **Filtros e identificadores visuais**: Badges e ícones dedicados no Dashboard, Detalhes da Compra e chips de filtro por categoria em Minhas Compras.
- **Migração segura do banco Room (`MIGRATION_1_2`)**: Atualização do schema SQLite para versão 2 preservando todos os dados existentes.
- **Migração nativa completa**: Arquitetura 100% Android nativa em Kotlin + Jetpack Compose + Material 3, Room, CameraX + ML Kit e Scraper HTTP com suporte a certificados SEFAZ.

### Changed

- **Restauração do design e paleta do React Native (#34)**:
  - Fundo azul-gelo característico do app original (`#EAF2F4`) e superfícies limpas em branco (`#FFFFFF`).
  - Acento roxo original (`#5B46CC`) para categorias e badges secundários.
  - Bordas sutis nos cartões e tipografia alinhada ao design original.
  - Atualização dos tokens em `Color.kt`, `Theme.kt` e `docs/DESIGN_SYSTEM.md`.
- **Modernização do pipeline de release**: Workflow `.github/workflows/release.yml` atualizado para compilação nativa com `./gradlew assembleRelease` e testes unitários.
- **Sincronização de versão**: `v0.4.1.0` com `versionCode 71` e `buildNumber 71` em `app.json` e `build.gradle.kts`.

### Added

- Shopping lists, historical price estimates and saved price-comparison sessions.
- Planning hub with top tabs for lists and price comparison.
- Sentry integration with privacy-oriented configuration.
- Shared UI header, accessibility refinements and color-token improvements.
- Pre-commit formatting, lint and type-check guardrails.

### Changed

- Dependency audit fixes and security overrides.
- CI guardrails for dependency auditing, privacy checks and pull-request size.
- Android native project is generated from Expo configuration during local and CI builds, preventing stale generated metadata.

### Fixed

- NFC-e import messages are bound to their expected origin.
- Update-check request timeouts are cleared after failures.
- Inputs, date picker behaviour and password-reset navigation.

### Security

- Hardened privacy controls, database rate limiting and database RPC exposure.

## [0.3.2.1] - 2026-05-17

### Fixed

- Configured the EAS `production` channel in installed APKs so they can receive compatible OTA updates.
- Ignored invalid non-version GitHub release tags in the APK update checker.
- Corrected the local release script after changing into the Android directory.

### Changed

- Bumped the application to version `0.3.2.1` with Android/iOS build number `66`.
- Documented OTA channel and runtime-version invariants in `AGENTS.md`.


## [1.2.3] - 2026-03-07

### Fixed
- Prepared the Android release line for the next GitHub release tag `v1.2.3`
- Standardized the generated release asset naming to `meugastov1.2.3.apk`

### Changed
- Updated app version to `1.2.3`
- Updated Android `versionCode` to `13`
- Updated iOS `buildNumber` to `13`

## [1.2.2] - 2026-03-07

### Fixed
- Aligned Android release packaging and naming with the `v1.2.2` release line
- Generated signed standalone release APK with embedded JavaScript bundle
- Standardized release asset naming to `meugastov1.2.2.apk`

### Changed
- Updated app version to `1.2.2`
- Updated Android `versionCode` to `12`
- Updated iOS `buildNumber` to `12`

## [1.2.0] - 2026-03-07

### Fixed
- **Critical:** Fixed app stuck on splash screen - environment variables now properly embedded in release APK bundle
- Fixed Supabase client initialization with proper error handling and fallback to in-memory storage
- Fixed AuthContext to handle missing Supabase configuration gracefully

### Changed
- Updated app version to `1.2.0`
- Updated Android `versionCode` to `10`
- Updated iOS `buildNumber` to `10`
- Improved error logging for debugging configuration issues
- Release workflow now validates environment variables before build

### Architecture
- Added ADR-002: Environment Variable Management in CI/CD Builds
- Workflow now passes environment variables explicitly to all critical build steps
- Added APK size validation in CI (minimum 40MB)

## [1.1.9] - 2026-03-07

### Fixed
- Release workflow now regenerates Android native files with `expo prebuild --clean` to avoid stale native metadata
- iOS builds now set an explicit `buildNumber`

### Changed
- Bumped mobile app version to `1.1.9`
- Set Android `versionCode` to `9`
- Set iOS `buildNumber` to `9`

## [1.1.8] - 2026-03-07

### Fixed
- Android releases now set an explicit `versionCode`, allowing installed APKs to upgrade correctly

### Changed
- Bumped mobile app version to `1.1.8`
- Set Android `versionCode` to `8`

## [1.1.7] - 2026-03-07

### Fixed
- Login now translates unexpected HTML responses from Supabase Auth into a clear configuration error
- Added diagnostic logging for the configured Supabase URL/auth endpoint when Android receives non-JSON auth responses

### Changed
- Bumped mobile app version to `1.1.7`

## [1.1.1] - 2026-03-07

### Fixed
- Correct NFC-e unit price calculation: now uses `unityPrice` before `totalPrice`
- Fixed promise rejection warnings in AuthContext.tsx

### Changed
- Updated AuthContext to handle async SplashScreen calls safely

## [1.1.0] - 2026-03-07

### Fixed
- GitHub Release workflow now limits ABIs for faster builds (`armeabi-v7a,arm64-v8a`)
- Release process streamlined to single job

### Changed
- App version bumped to 1.1.0

### Fixed
- Simplified GitHub release workflow to build and publish APK in a single job
- Removed fragile artifact handoff between jobs that could fail with missing artifact errors

### Changed
- Bumped mobile app version to `1.0.2` in `mobile/app.json` and `mobile/package.json`

## [1.0.1] - 2026-03-06

### Security
- Migrated Supabase session storage to encrypted secure storage
- Added NFC-e payload validation and sanitization before persistence
- Hardened NFC-e WebView navigation validation (HTTPS + host/path checks)
- Added SQL-side validation/constraints for purchase and item data
- Added CSV injection protection for report exports

## [1.0.0] - 2026-03-06

### Added
- Initial release
- NFC-e QR code scanning and parsing
- Purchase management (create, edit, delete)
- Draft system for incomplete purchases
- Dashboard with spending statistics
- Reports by supermarket and items
- User authentication (login, register, password recovery)
- Profile management

### Refactored
- TypeScript types: renamed Rascunho to Draft
- Extracted helpers: findOrCreateSupermarket, mapPurchaseItems, buildDateRange
- Navigation types moved to separate file

### Security
- Updated .gitignore to exclude .env files
- API URLs moved to environment variables
