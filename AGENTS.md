# AGENTS.md - Projeto Mercado

## Visão Geral do Projeto

Projeto de gestão de compras de supermercado com scanning de NFC-e (nota fiscal eletrônica). O app mobile (Expo/React Native) foi migrado de um backend Node.js local para Supabase (Auth + PostgreSQL).

### Estrutura

```
projeto-mercado/
├── mobile/          # App React Native/Expo (principal)
├── backend/         # API Node.js (deprecated)
├── frontend/        # App Web React/Vite (deprecated)
└── supabase_schema.sql
```

---

## Comandos

### Mobile (Expo)

```bash
cd mobile

# Desenvolvimento
npm start           # Iniciar Expo
npm run android     # Build Android
npm run web         # Executar web

# TypeScript (verificação)
npx tsc --noEmit   # Verificar tipos (sem build)
```

### Backend (Node.js/Express - Deprecated)

```bash
cd backend

npm start           # Produção
npm run dev         # Desenvolvimento com nodemon
npm run lint        # ESLint
npm run test        # Jest
```

### Frontend (Vite - Deprecated)

```bash
cd frontend

npm run dev         # Desenvolvimento
npm run build       # Build produção
npm run lint        # ESLint
npm run preview     # Preview do build
```

---

## Convenções de Código

### Nomenclatura

- **Componentes**: PascalCase (`PurchaseCard.tsx`, `NFCeWebView.tsx`)
- **Services/Utils**: camelCase (`purchaseService.ts`, `nfceService.ts`)
- **Interfaces/Types**: PascalCase descritiva (`NFCeItem`, `Purchase`, `Item`)
- **Arquivos**: kebab-case (`scan-qr-code-screen.tsx`)

### Estrutura de Arquivos Mobile

```
src/
├── components/     # Componentes reutilizáveis
├── screens/       # Telas/pages
├── services/      # Lógica de negócio (Supabase)
├── context/       # React Context (auth, purchases)
├── types/         # TypeScript interfaces
├── utils/         # Funções auxiliares
├── navigation/    # Configuração React Navigation
└── lib/          # Configurações (supabaseClient)
```

### Imports

```typescript
// Relative imports (mesmo projeto)
import { purchaseService } from '../services';
import { Purchase } from '../types';

// Third-party
import { WebView } from 'react-native-webview';
import { supabase } from '../lib/supabaseClient';
```

### Null Safety (CRÍTICO)

**SEMPRE use optional chaining e nullish coalescing:**

```typescript
// ❌ ERRADO - pode causar "Cannot read property 'name' of null"
purchase.supermarket.name
purchase.products.length

// ✅ CORRETO
purchase.supermarket?.name ?? 'Supermercado'
purchase.products?.length ?? 0

// ❌ ERRADO
purchase.products.map(...)

// ✅ CORRETO
(purchase.products ?? []).map(...)
```

**Referências:**
- `PurchaseDetailScreen.tsx`
- `PurchasesScreen.tsx`
- `PurchaseCard.tsx`

### TypeScript

```typescript
// Interface
interface NFCeItem {
  name: string;
  quantity: number;
  unit: string;
  unityPrice: number;
  totalPrice: number;
}

// Type com exportação
export interface Purchase {
  id: number;
  supermarket: Supermarket;
  products: Item[];
  // ...
}
```

---

## Supabase

### Configuração

O app mobile usa Supabase para autenticação e banco de dados:

```typescript
// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

### Variáveis de Ambiente (Mobile)

Criar `.env` na pasta `mobile/`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Schema

O schema está em `mobile/supabase_schema.sql`:
- Tabelas: `profiles`, `supermarkets`, `purchases`, `items`, `drafts`
- RLS (Row Level Security) ativo em todas as tabelas
- Policies configuradas para usuário autenticado

### User ID

**IMPORTANTE**: O `user_id` é UUID do Supabase Auth. Obtendo:

```typescript
const getCurrentUserId = async (): Promise<string> => {
  const { user } = await authService.getSession();
  if (!user?.id) {
    throw new Error('User not authenticated');
  }
  return user.id;
};
```

---

## Erros Comuns e Debug

### Debug de Supabase

Adicione logs nos services:

```typescript
const { data: items, error: itemsError } = await supabase
  .from('items')
  .select('*')
  .eq('purchase_id', purchase.id);

if (itemsError) {
  console.log('[DEBUG] Erro ao buscar items:', itemsError);
}
console.log('[DEBUG] Items retornados:', items?.length);
```

### Problemas Conhecidos

1. **RLS bloqueando inserts**: Sempre use `user_id: userId` (não `null`)
2. **Dados undefined na UI**: Use `?? []` e `?.` conforme seção Null Safety
3. **Items não aparecem**: Verificar se foram salvos com `purchase_id` correto

---

## NFC-e (WebView Scraping)

O app extrai dados da NFC-e via WebView do SEFAZ-RS:

- URL: `https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce`
- Script de scraping em `NFCeWebView.tsx`
- Flag `window.NFCE_SCRAPE_DONE` evita execuções múltiplas

### Dados Extraídos

```typescript
interface NFCeScrapedData {
  storeName: string;
  cnpj: string;
  emittedAt: string;
  total: number;
  items: NFCeItem[];
}
```

---

## Padrões de Código

### Funções Assíncronas

```typescript
// sempre use try-catch em handlers de UI
const loadPurchases = async () => {
  try {
    setIsLoading(true);
    const data = await purchaseService.getPurchases();
    setPurchases(data);
  } catch (err: any) {
    setError(err.message || 'Erro ao carregar');
  } finally {
    setIsLoading(false);
  }
};
```

### Handlers de Eventos

```typescript
// use Alert para feedback de erros
const handleWebViewError = (error: string) => {
  setShowWebView(false);
  setIsProcessing(false);
  Alert.alert('Erro', error);
};
```

### Componentes React

```typescript
// use useCallback para funções passadas como props
const loadPurchases = useCallback(async (filter?: PurchaseFilter) => {
  await fetchPurchases(filter);
}, [fetchPurchases]);

// use useEffect para carregamento inicial
useEffect(() => {
  loadPurchases();
}, []);
```

---

## Testes

O projeto **NÃO possui testes unitários** configurados no mobile.

Para backend:
```bash
cd backend
npm test
```

---

## Linting

### Mobile

```bash
# Não configurado - usar TypeScript
cd mobile && npx tsc --noEmit
```

### Backend

```bash
cd backend && npm run lint
```

### Frontend

```bash
cd frontend && npm run lint
```

---

## Build Mobile

```bash
cd mobile

# Android (APK)
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug

# ou via Expo
npx expo run:android
```

---

## Referências Rápidas

| Recurso | Arquivo |
|---------|---------|
| Schema BD | `mobile/supabase_schema.sql` |
| Cliente Supabase | `mobile/src/lib/supabaseClient.ts` |
| Tipos | `mobile/src/types/index.ts` |
| Services | `mobile/src/services/*.ts` |
| Screens | `mobile/src/screens/*.tsx` |
| Componentes | `mobile/src/components/*.tsx` |
| Scraping NFC-e | `mobile/src/components/NFCeWebView.tsx` |

---

## Regras de Segurança

1. **NUNCA commitar secrets**: Use `.env` e `.gitignore`
2. **Credentials no Supabase**: Apenas `EXPO_PUBLIC_` vars no mobile
3. **RLS**: Sempre manter habilitado nas tabelas
4. **Validação**: Validar dados antes de inserir no banco
