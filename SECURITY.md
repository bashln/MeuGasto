# Security Plan - MeuGasto

**Documento de Segurança do Projeto**  
**Versão:** 1.0.0  
**Data:** 06/03/2026  
**Status:** Em Implementação

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Vulnerabilidades Identificadas](#vulnerabilidades-identificadas)
3. [Plano de Correção](#plano-de-correção)
4. [Implementações Técnicas](#implementações-técnicas)
5. [Checklist de Segurança](#checklist-de-segurança)

---

## Visão Geral

Este documento detalha o plano de correção de vulnerabilidades de segurança identificadas na auditoria do MeuGasto em 06/03/2026.

### Severidade

| Nível | Descrição | Tempo de Resposta |
|-------|-----------|-------------------|
| 🔴 Crítica | Comprometimento de dados ou sistema | 24h |
| 🟡 Alta | Risco significativo de exposição | 48h |
| 🟡 Média | Vulnerabilidade controlada | 7 dias |
| 🟢 Baixa | Melhoria recomendada | 30 dias |

---

## Vulnerabilidades Identificadas

### SEC-001: Armazenamento Inseguro de Sessão

**Componente:** `mobile/src/lib/supabaseClient.ts`  
**Severidade:** 🔴 Crítica  
**CVSS Estimado:** 7.5

#### Descrição
A sessão do Supabase é armazenada em `AsyncStorage`, que não é criptografada. Em dispositivos rootados/jailbroken, os tokens de autenticação podem ser extraídos.

#### Código Vulnerável
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,  // ❌ Inseguro
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

#### Solução Proposta
```typescript
import * as SecureStore from 'expo-secure-store';

const SecureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStorageAdapter,  // ✅ Seguro
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

#### Teste de Validação
```typescript
// Teste: Verificar se dados estão criptografados
const token = await SecureStore.getItemAsync('supabase.auth.token');
expect(token).toBeDefined();
// AsyncStorage não deve conter o token
const asyncToken = await AsyncStorage.getItem('supabase.auth.token');
expect(asyncToken).toBeNull();
```

---

### SEC-002: Vazamento de Dados Fiscais

**Componente:** `mobile/src/services/nfceService.ts`  
**Severidade:** 🟡 Alta  
**CVSS Estimado:** 5.8

#### Descrição
A chave de acesso NFC-e (44 dígitos) é enviada em texto plano para um scraper externo (`nfce-scraper.herokuapp.com`), expondo dados fiscais do usuário a terceiros.

#### Código Vulnerável
```typescript
const response = await fetch(
  `${NFCE_SCRAPER_BASE_URL}/nfce?nfce_url=${encodeURIComponent(url)}`
  // ❌ Chave completa exposta na URL
);
```

#### Solução Proposta
```typescript
// 1. Hash da chave antes do envio (para cache/tracking)
const keyHash = await crypto.subtle.digest('SHA-256', accessKey);

// 2. Implementar criptografia de dados em trânsito
const encryptedData = await encryptWithPublicKey({
  url: nfceUrl,
  keyHash: keyHash,
  timestamp: Date.now(),
});

const response = await fetch(`${NFCE_SCRAPER_BASE_URL}/nfce`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': APP_VERSION,
  },
  body: JSON.stringify({ payload: encryptedData }),
});
```

#### Teste de Validação
```typescript
// Teste: Verificar se chave não aparece em logs/requests
const mockFetch = jest.spyOn(global, 'fetch');
await nfceService.consultQRCode(qrCodeData);
const callArgs = mockFetch.mock.calls[0];
expect(callArgs[0]).not.toContain(accessKey);
expect(callArgs[1]?.body).toBeDefined();
```

---

### SEC-003: Injeção via WebView

**Componente:** `mobile/src/components/NFCeWebView.tsx`  
**Severidade:** 🟡 Alta  
**CVSS Estimado:** 6.1

#### Descrição
Dados retornados pelo WebView scraping são processados sem validação de schema, permitindo potencial injeção de código malicioso.

#### Código Vulnerável
```typescript
const handleMessage = (event: { nativeEvent: { data?: string } }) => {
  const message = JSON.parse(event.nativeEvent.data ?? '{}');
  // ❌ Sem validação de schema
  if (message.type === 'NFCE_SCRAPE_RESULT') {
    if (message.ok) {
      onSuccess(message.data);  // Dados injetados diretamente
    }
  }
};
```

#### Solução Proposta
```typescript
import { z } from 'zod';

// Schema de validação strict
const NFCeItemSchema = z.object({
  name: z.string().max(200).regex(/^[\w\s\-]+$/),
  quantity: z.number().positive().max(9999),
  unit: z.enum(['UN', 'KG', 'L', 'ML', 'G', 'PC', 'CX']),
  unityPrice: z.number().nonnegative().max(999999),
  totalPrice: z.number().nonnegative().max(999999),
});

const NFCeScrapedDataSchema = z.object({
  storeName: z.string().max(100),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
  city: z.string().max(50),
  state: z.string().length(2),
  total: z.number().positive(),
  items: z.array(NFCeItemSchema).max(500),
});

const handleMessage = (event: { nativeEvent: { data?: string } }) => {
  try {
    const rawMessage = JSON.parse(event.nativeEvent.data ?? '{}');
    
    // ✅ Validar schema antes de processar
    if (rawMessage.type === 'NFCE_SCRAPE_RESULT' && rawMessage.ok) {
      const validated = NFCeScrapedDataSchema.parse(rawMessage.data);
      onSuccess(validated);
    }
  } catch (error) {
    securityLogger.warn('Invalid WebView data schema', { error });
    onError('Dados da nota fiscal inválidos');
  }
};
```

#### Teste de Validação
```typescript
// Teste: Rejeitar dados malformados
const maliciousData = {
  type: 'NFCE_SCRAPE_RESULT',
  ok: true,
  data: {
    storeName: '<script>alert("xss")</script>',
    cnpj: 'invalid',
    items: [{ name: 'test', quantity: -1 }],  // Quantidade negativa
  },
};

expect(() => NFCeScrapedDataSchema.parse(maliciousData.data))
  .toThrow();
```

---

### SEC-004: Validação Insuficiente na Função SQL

**Componente:** `mobile/supabase_schema.sql` - `create_purchase_with_items`  
**Severidade:** 🟡 Alta  
**CVSS Estimado:** 5.3

#### Descrição
A função `create_purchase_with_items` aceita dados JSONB sem validações rigorosas de tamanho, formato ou ranges, permitindo inserção de dados malformados.

#### Código Vulnerável
```sql
CREATE OR REPLACE FUNCTION public.create_purchase_with_items(...)
-- ❌ Sem validações nos parâmetros
INSERT INTO items (purchase_id, name, code, quantity, unit, price)
SELECT
  v_purchase_id,
  item.name,  -- Sem limite de tamanho
  NULLIF(item.code, ''),
  COALESCE(item.quantity, 1),  -- Sem validação de range
  NULLIF(item.unit, ''),
  COALESCE(item.price, 0)  -- Aceita valores negativos
FROM jsonb_to_recordset(p_items) AS item(...);
```

#### Solução Proposta
```sql
CREATE OR REPLACE FUNCTION public.create_purchase_with_items(
  p_user_id UUID,
  p_supermarket_id INTEGER,
  p_access_key TEXT,
  p_date DATE,
  p_total_price NUMERIC,
  p_manual BOOLEAN,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(purchase_id INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_purchase_id INTEGER;
  v_item JSONB;
  v_name TEXT;
  v_quantity NUMERIC;
  v_price NUMERIC;
BEGIN
  -- ✅ Validar access_key (44 dígitos)
  IF p_access_key IS NOT NULL AND p_access_key !~ '^\d{44}$' THEN
    RAISE EXCEPTION 'Invalid access key format';
  END IF;

  -- ✅ Validar data (não futura, não muito antiga)
  IF p_date > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Future dates not allowed';
  END IF;
  IF p_date < CURRENT_DATE - INTERVAL '1 year' THEN
    RAISE EXCEPTION 'Date too old';
  END IF;

  -- ✅ Validar total (positivo, máximo razoável)
  IF p_total_price <= 0 OR p_total_price > 999999.99 THEN
    RAISE EXCEPTION 'Invalid total price';
  END IF;

  -- ... resto da função com validações nos items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_name := v_item->>'name';
    v_quantity := (v_item->>'quantity')::NUMERIC;
    v_price := (v_item->>'price')::NUMERIC;

    -- Validar cada item
    IF LENGTH(v_name) > 200 OR LENGTH(v_name) < 1 THEN
      RAISE EXCEPTION 'Invalid item name length';
    END IF;
    
    IF v_quantity <= 0 OR v_quantity > 9999 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    
    IF v_price < 0 OR v_price > 999999.99 THEN
      RAISE EXCEPTION 'Invalid price';
    END IF;
  END LOOP;

  -- ... inserção
END;
$$;
```

#### Teste de Validação
```sql
-- Teste: Rejeitar dados inválidos
SELECT * FROM create_purchase_with_items(
  'user-id',
  1,
  'invalid-key',  -- Deve falhar
  CURRENT_DATE,
  -100,  -- Valor negativo, deve falhar
  false,
  '[{"name": "test", "quantity": -1, "price": 10}]'::JSONB  -- Quantidade negativa
);
-- Esperado: ERRO
```

---

### SEC-005: Whitelist por Hostname Apenas

**Componente:** `mobile/src/services/nfceService.ts`  
**Severidade:** 🟡 Média  
**CVSS Estimado:** 4.3

#### Descrição
A validação de URLs apenas verifica o hostname, permitindo potencial bypass via subdomínios maliciosos ou paths não intencionais.

#### Código Vulnerável
```typescript
export const isAllowedNfceUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return NFCE_ALLOWED_HOSTS.has(parsed.hostname);  // ❌ Apenas hostname
  } catch {
    return false;
  }
};
```

#### Solução Proposta
```typescript
interface URLValidationRule {
  hostname: string;
  protocol: 'https:';
  allowedPaths?: RegExp[];
  requiredParams?: string[];
}

const NFCeURLRules: URLValidationRule[] = [
  {
    hostname: 'dfe-portal.svrs.rs.gov.br',
    protocol: 'https:',
    allowedPaths: [/^\/Dfe\/QrCodeNFce$/],
    requiredParams: ['p'],
  },
  // ... outras regras
];

export const isAllowedNfceUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    
    // ✅ Validar protocolo
    if (parsed.protocol !== 'https:') return false;
    
    // ✅ Encontrar regra correspondente
    const rule = NFCeURLRules.find(r => r.hostname === parsed.hostname);
    if (!rule) return false;
    
    // ✅ Validar path
    if (rule.allowedPaths) {
      const pathValid = rule.allowedPaths.some(regex => regex.test(parsed.pathname));
      if (!pathValid) return false;
    }
    
    // ✅ Validar parâmetros obrigatórios
    if (rule.requiredParams) {
      const params = new URLSearchParams(parsed.search);
      const hasAllParams = rule.requiredParams.every(p => params.has(p));
      if (!hasAllParams) return false;
    }
    
    return true;
  } catch {
    return false;
  }
};
```

#### Teste de Validação
```typescript
// Teste: Rejeitar URLs maliciosas
expect(isAllowedNfceUrl('http://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=123'))
  .toBe(false);  // HTTP não permitido

expect(isAllowedNfceUrl('https://malicious.svrs.rs.gov.br/Dfe/QrCodeNFce?p=123'))
  .toBe(false);  // Subdomínio não permitido

expect(isAllowedNfceUrl('https://dfe-portal.svrs.rs.gov.br/admin?p=123'))
  .toBe(false);  // Path não permitido
```

---

## Plano de Correção

### Fase 1: Hotfixes (48 horas)

| ID | Tarefa | Responsável | Status |
|----|--------|-------------|--------|
| SEC-001 | Implementar SecureStore | @dev-team | 🟡 Em progresso |
| SEC-002 | Hash de chaves NFC-e | @dev-team | 🟡 Em progresso |
| SEC-003 | Schema validation WebView | @dev-team | 🟡 Em progresso |
| SEC-005 | Reforçar whitelist | @dev-team | 🟡 Em progresso |

### Fase 2: Hardening (7 dias)

| ID | Tarefa | Responsável | Status |
|----|--------|-------------|--------|
| SEC-004 | Validações SQL | @backend-team | ⚪ Planejado |
| SEC-002 | TLS 1.3 + Cert Pinning | @dev-team | ⚪ Planejado |
| SEC-003 | CSP no WebView | @dev-team | ⚪ Planejado |
| LOG-001 | Security Logging | @dev-team | ⚪ Planejado |

### Fase 3: Reforço (30 dias)

| ID | Tarefa | Responsável | Status |
|----|--------|-------------|--------|
| CI-001 | Security Scanning no CI | @devops-team | ⚪ Planejado |
| SEC-002 | Cache criptografado | @dev-team | ⚪ Planejado |
| SEC-003 | WebView sandboxed | @dev-team | ⚪ Planejado |
| DOC-001 | Documentação completa | @tech-lead | ⚪ Planejado |

---

## Implementações Técnicas

### 1. SecureStore Adapter

```typescript
// mobile/src/lib/secureStorageAdapter.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const SecureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      // Fallback para web (desenvolvimento)
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
```

### 2. Security Logger

```typescript
// mobile/src/utils/securityLogger.ts
type SecurityEventType = 
  | 'AUTH_FAILURE'
  | 'NAVIGATION_BLOCKED'
  | 'VALIDATION_FAILURE'
  | 'SCRAPING_ERROR';

interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  details: Record<string, unknown>;
  userId?: string;
}

export const securityLogger = {
  log: (event: SecurityEvent) => {
    // Enviar para serviço de logging
    console.warn('[SECURITY]', event);
    
    // Em produção, enviar para Supabase/Sentry
    if (!__DEV__) {
      // supabase.from('security_logs').insert(event);
    }
  },
  
  warn: (message: string, details?: Record<string, unknown>) => {
    securityLogger.log({
      type: 'VALIDATION_FAILURE',
      timestamp: Date.now(),
      details: { message, ...details },
    });
  },
};
```

### 3. Content Security Policy

```typescript
// mobile/src/components/NFCeWebView.tsx
const CSP_HEADERS = `
  default-src 'none';
  script-src 'unsafe-inline';
  connect-src 'self';
  img-src 'self' data:;
  style-src 'unsafe-inline';
`;

// Injetar CSP no WebView
const injectedJavaScript = `
  (function() {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = '${CSP_HEADERS.replace(/\n/g, ' ')}';
    document.head.appendChild(meta);
  })();
`;
```

---

## Checklist de Segurança

### Pre-Commit

- [ ] Nenhum secret/commit no código
- [ ] Validações de input implementadas
- [ ] Testes de segurança passando

### Pre-Release

- [ ] Auditoria de dependências (`npm audit`)
- [ ] Scan de secrets (`git-secrets`, `truffleHog`)
- [ ] Testes de injeção passando
- [ ] Revisão de código focada em segurança

### Pós-Deploy

- [ ] Monitoramento de logs de segurança
- [ ] Métricas de segurança dentro do esperado
- [ ] Plano de resposta a incidentes ativo

---

## Referências

- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [OWASP Top 10 Mobile](https://owasp.org/www-project-mobile-top-10/)
- [Expo Security](https://docs.expo.dev/guides/security/)
- [Supabase Security](https://supabase.com/docs/guides/database/security)

---

*Documento mantido pela equipe de segurança do MeuGasto*
*Última atualização: 06/03/2026*
