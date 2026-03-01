# QWEN.md - Projeto Mercado

## Project Overview

**Projeto Mercado** is a mobile application for intelligent supermarket purchase management. The app focuses on expense control, purchase organization, and NFC-e (Brazilian electronic invoice) integration. It is architected with potential SaaS evolution in mind.

### Current Status
- **Phase**: Pre-Alpha (functional validation on real devices)
- **License**: GNU AGPLv3

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Mobile** | Expo + React Native + TypeScript |
| **Backend** | Supabase (Auth, PostgreSQL, RLS) |
| **Database** | PostgreSQL |
| **UI Library** | React Native Paper (Material Design 3) |
| **Navigation** | React Navigation (Stack + Bottom Tabs) |
| **State Management** | React Context (Auth, Purchase, Draft) |
| **Build** | EAS Build (Android APK/App Bundle) |

---

## Project Structure

```
projeto-mercado/
├── mobile/                          # Expo application
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   │   ├── DraftCard.tsx
│   │   │   ├── ErrorMessage.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Loading.tsx
│   │   │   ├── MonthYearPicker.tsx
│   │   │   ├── NFCeWebView.tsx      # WebView for NFC-e scraping
│   │   │   ├── PurchaseCard.tsx
│   │   │   └── QRCodeScanner.tsx
│   │   ├── context/                 # React Context providers
│   │   │   ├── AuthContext.tsx
│   │   │   ├── DraftContext.tsx
│   │   │   └── PurchaseContext.tsx
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Library configurations
│   │   │   └── supabaseClient.ts
│   │   ├── navigation/              # React Navigation setup
│   │   │   └── AppNavigator.tsx
│   │   ├── screens/                 # App screens
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── DraftsScreen.tsx
│   │   │   ├── DraftDetailScreen.tsx
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── RegisterScreen.tsx
│   │   │   ├── PurchasesScreen.tsx
│   │   │   ├── PurchaseDetailScreen.tsx
│   │   │   ├── PurchaseEditScreen.tsx
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── EditProfileScreen.tsx
│   │   │   ├── ReportsScreen.tsx
│   │   │   └── ScanQRCodeScreen.tsx
│   │   ├── services/                # Business logic & Supabase calls
│   │   │   ├── authService.ts
│   │   │   ├── purchaseService.ts
│   │   │   ├── draftService.ts
│   │   │   ├── draftContent.ts
│   │   │   ├── nfceService.ts
│   │   │   ├── supermarketService.ts
│   │   │   └── reportService.ts
│   │   ├── store/                   # Redux Toolkit (empty - not in use)
│   │   ├── theme/                   # Theme configuration
│   │   │   └── colors.ts
│   │   ├── types/                   # TypeScript interfaces
│   │   │   └── index.ts
│   │   └── utils/                   # Helper functions
│   │       ├── formatMoney.ts
│   │       └── formatDate.ts
│   ├── assets/                      # Images, fonts, icons
│   ├── supabase_schema.sql          # Database schema with RLS policies
│   ├── App.tsx                      # App entry point
│   ├── app.json                     # Expo configuration
│   ├── eas.json                     # EAS Build configuration
│   ├── package.json
│   └── tsconfig.json
├── assets_backup/                   # Backup of assets
├── README.md
├── AGENTS.md                        # Agent-specific guidelines
├── CLAUDE.md                        # Claude Code guidelines
└── LICENSE (AGPLv3)
```

---

## Database Schema

The Supabase database consists of 5 main tables with Row Level Security (RLS) enabled:

| Table | Description |
|-------|-------------|
| `profiles` | Extends `auth.users` with name and role |
| `supermarkets` | User-created or auto-detected supermarkets |
| `purchases` | Purchase records linked to supermarkets |
| `items` | Individual items within each purchase |
| `drafts` | Saved draft purchases (JSON content) |

**Key Features:**
- RLS policies ensure users can only access their own data
- Auto-create profile trigger on user signup
- Indexes on `user_id`, `date`, and foreign keys for performance

---

## Building and Running

### Prerequisites
- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Supabase project (for backend)

### Development Setup

```bash
cd mobile

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials:
# EXPO_PUBLIC_SUPABASE_URL=your_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key

# Start development server
npm start
# or
npx expo start

# Start with cleared cache (if needed)
npx expo start --clear

# Run on specific platform
npm run android
npm run ios
npm run web
```

### Testing

```bash
cd mobile

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

**Test Files:**
- `src/utils/__tests__/formatMoney.test.ts`
- `src/utils/__tests__/formatDate.test.ts`
- `src/services/__tests__/draftContent.test.ts`
- `src/services/__tests__/draftService.test.ts`

### Building Android APK

```bash
cd mobile

# Development build (APK)
eas build -p android --profile preview

# Production build (App Bundle)
eas build -p android --profile production
```

---

## Key Features

### NFC-e Integration
The app supports Brazilian NFC-e (Nota Fiscal de Consumidor Eletrônica) scanning:
1. **QR Code Scanner**: Uses `expo-camera` to scan NFC-e QR codes
2. **WebView Scraping**: `NFCeWebView.tsx` injects JavaScript to scrape SEFAZ-RS portal
3. **Auto-detection**: Extracts store name, CNPJ, date, total, and items
4. **Fallback**: External API (`nfce-scraper.herokuapp.com`) as backup

### Authentication Flow
- Email/password authentication via Supabase Auth
- Auto-create profile on signup
- Session persistence with `expo-secure-store`
- Protected routes via `AppNavigator`

### Main Features
- **Dashboard**: Overview of spending statistics
- **Purchases**: List, view, edit, and delete purchase history
- **Drafts**: Save and convert draft purchases
- **Reports**: Spending analytics and charts
- **Profile**: User settings and account management

---

## Development Conventions

### TypeScript
- **Strict mode**: Enabled (`"strict": true` in `tsconfig.json`)
- **Base config**: Extends `expo/tsconfig.base`

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PurchaseCard.tsx`, `NFCeWebView.tsx` |
| Services/Utils | camelCase | `purchaseService.ts`, `nfceService.ts` |
| Interfaces/Types | PascalCase | `NFCeItem`, `Purchase`, `PurchaseFilter` |
| Screen Files | PascalCase + "Screen" suffix | `LoginScreen.tsx`, `PurchasesScreen.tsx` |

### Code Style
- **Null Safety**: Always use optional chaining (`?.`) and nullish coalescing (`??`)
  ```typescript
  // Correct
  purchase.supermarket?.name ?? 'Supermercado'
  (purchase.products ?? []).map(...)
  ```
- **Async Error Handling**: Use try-catch in all async handlers
- **React Best Practices**: 
  - `useCallback` for memoized functions
  - `useEffect` for side effects
  - Proper cleanup in effects

### State Management
- **Primary**: React Context (`AuthContext`, `PurchaseContext`, `DraftContext`)
- **Redux**: Present but empty (not actively used)

---

## Environment Variables

Create `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## API Reference

### Services

| Service | Description |
|---------|-------------|
| `authService` | Login, register, logout, session management |
| `purchaseService` | CRUD operations for purchases |
| `draftService` | Draft management and conversion to purchases |
| `nfceService` | NFC-e consultation and parsing |
| `supermarketService` | Supermarket CRUD |
| `reportService` | Spending analytics |

### Key Service Functions

```typescript
// Auth
authService.login({ email, password })
authService.register({ email, password, name })
authService.getSession()

// Purchases
purchaseService.getPurchases(filter?)
purchaseService.getPurchaseById(id)
purchaseService.createManualPurchase({ date, totalPrice, items })
purchaseService.deletePurchase(id)

// NFC-e
nfceService.createPurchaseFromNFCe(qrCodeData)
nfceService.createPurchaseFromScrapedData(scrapedData, accessKey)

// Drafts
draftService.getDrafts()
draftService.createDraft({ conteudo, items })
draftService.convertDraftToPurchase(draftId)
```

---

## Navigation Structure

### Auth Stack (Unauthenticated)
- `Login` → `Register` → `ForgotPassword`

### Main App (Authenticated)
- **Bottom Tabs**: Dashboard, Purchases, Drafts, Reports, Profile
- **Modal Stack**: PurchaseDetail, PurchaseEdit, DraftDetail, ScanQRCode, EditProfile

---

## Common Issues & Debugging

### RLS Blocking Inserts
Always include `user_id: userId` (UUID from Supabase Auth) on inserts. RLS will reject rows without it.

### Null Data from Supabase
Relations can return `null`. Always use:
```typescript
purchase.supermarket?.name ?? 'Supermercado'
purchase.products?.length ?? 0
```

### Debugging Supabase Queries
Add logs to services:
```typescript
const { data, error } = await supabase.from('items').select('*');
if (error) console.log('[DEBUG] Error:', error);
console.log('[DEBUG] Items:', data?.length);
```

### NFC-e Scraping Issues
- The WebView script uses `window.NFCE_SCRAPE_DONE` flag to prevent duplicate execution
- Timeout is set to 30 seconds by default
- Debug mode: `const DEBUG = __DEV__ || false;` in `NFCeWebView.tsx`

---

## Testing Practices

### Current Test Coverage
- **Utils**: `formatMoney`, `formatDate` (full coverage)
- **Services**: `draftService`, `draftContent` (mocked Supabase)

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
```

### Test Structure
- Tests use Jest with `jest-expo` preset
- Supabase is mocked using `jest.mock()`
- Fluent interface mocking for Supabase query chains

---

## Deployment

### EAS Build Profiles

| Profile | Distribution | Android Build Type |
|---------|--------------|-------------------|
| `development` | Internal | APK |
| `preview` | Internal | APK |
| `production` | Play Store | App Bundle (AAB) |

### Build Commands
```bash
# Preview APK
eas build -p android --profile preview

# Production App Bundle
eas build -p android --profile production
```

---

## Related Files

| Purpose | File |
|---------|------|
| Database Schema | `mobile/supabase_schema.sql` |
| Supabase Client | `mobile/src/lib/supabaseClient.ts` |
| Type Definitions | `mobile/src/types/index.ts` |
| App Entry | `mobile/App.tsx` |
| Navigation | `mobile/src/navigation/AppNavigator.tsx` |
| NFC-e Scraping | `mobile/src/components/NFCeWebView.tsx` |
| Theme Colors | `mobile/src/theme/colors.ts` |

---

## Notes

- **Redux**: The Redux store (`src/store/index.ts`) is empty and not actively used. State is managed via React Context.
- **Backend/Frontend**: The `backend/` and `frontend/` directories are deprecated. All active development is in `mobile/`.
- **NFC-e Scraper**: Primary scraping is done locally via WebView. External API is a fallback.
- **Logs**: Debug logs are conditionally enabled via `__DEV__` flag in development.
