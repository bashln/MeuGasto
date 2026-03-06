# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
