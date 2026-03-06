# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-03-06

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
