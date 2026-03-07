# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
