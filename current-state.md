# Estado Atual do Projeto - MeuGasto

**Data da atualização:** 06/03/2026  
**Versão atual:** v1.1.0 (Otimização de Build e Estabilidade)

---

## Visão Geral

O MeuGasto é um aplicativo mobile para gestão de compras de supermercado com foco em automação via leitura de NFC-e (Nota Fiscal de Consumidor Eletrônica). O pipeline de CI/CD foi otimizado para builds mais estáveis e rápidos.

### Release v1.1.0
- **Publicação:** Manual (APK) devido a incidente no workflow de CI
- **Otimização:** Build Android limitado a ABIs de produção (`armeabi-v7a,arm64-v8a`)
- **Status:** Estável em produção

---

## Estrutura do Projeto

```
/run/media/dev/stow/bashln/bashln/gitlab/MeuGasto/
├── blueprints.md           # Documentação de arquitetura
├── README.md               # Documentação geral
├── LICENSE                 # Licença MIT
├── .gitignore              # Configurações de exclusão do Git
├── mobile/                 # Aplicação mobile (Expo + React Native)
│   ├── src/
│   │   ├── components/     # 12 componentes reutilizáveis
│   │   ├── screens/        # 14 telas principais
│   │   ├── navigation/     # Configuração de navegação
│   │   ├── services/       # 6 serviços + testes
│   │   ├── hooks/          # 2 custom hooks
│   │   ├── context/        # 3 contextos React
│   │   ├── types/          # Tipos TypeScript
│   │   ├── utils/          # Utilitários + testes
│   │   ├── theme/          # Design system
│   │   └── lib/            # Cliente Supabase
│   ├── .env.example        # Template de variáveis de ambiente
│   ├── package.json        # Dependências
│   └── supabase_schema.sql # Schema do banco
└── assets_backup/          # Backup de assets
```

---

## Funcionalidades Implementadas

### ✅ Autenticação
- Login com email/senha via Supabase Auth
- Cadastro de novos usuários
- Recuperação de senha via email
- Perfil de usuário editável

### ✅ Dashboard
- Hero card com gasto total do mês
- Comparação percentual vs mês anterior
- Grid de métricas (total de compras, itens, ticket médio)
- Insights automáticos (supermercado mais frequente, item mais comprado)
- Seletor de mês/ano

### ✅ Compras
- Listagem paginada (infinite scroll)
- Filtros avançados (supermercado, tipo: NFC-e/Manual, faixa de preço)
- Busca textual
- Detalhes da compra com lista de itens
- Edição de compras manuais (data, total, supermercado)
- Exclusão de compras

### ✅ NFC-e (QR Code)
- Scanner de QR Code nativo (expo-camera)
- Extração de chave de acesso (44 dígitos)
- Consulta via API externa (nfce-scraper)
- WebView scraping fallback para RS
- Suporte a múltiplos estados brasileiros
- Mapeamento automático de supermercados por CNPJ

### ✅ Rascunhos (Drafts)
- Listagem de rascunhos
- Criação com itens ou apenas notas
- Edição completa
- Conversão para compra
- Exclusão

### ✅ Relatórios
- Gráfico de evolução mensal
- Top itens mais comprados
- Gastos por supermercado
- Exportação CSV

---

## Arquitetura de Código

### Serviços (Services)
| Serviço | Responsabilidade | Helpers Extraídos |
|---------|------------------|-------------------|
| `authService.ts` | Autenticação e sessão | `getCurrentUserId()` |
| `purchaseService.ts` | CRUD de compras | `mapPurchaseItems()` |
| `supermarketService.ts` | Gestão de supermercados | - |
| `draftService.ts` | Gestão de rascunhos | `parseContent()`, `serializeContent()` |
| `reportService.ts` | Relatórios e estatísticas | `buildDateRange()` |
| `nfceService.ts` | NFC-e scraping | `findOrCreateSupermarket()`, `extractAccessKeyFromQRCode()`, `parseQrInput()`, `buildNFCeUrl()` |

### Hooks Customizados
- `useDashboard()` - Estado e carregamento do dashboard
- `useReports()` - Estado e carregamento de relatórios

### Contextos
- `AuthContext` - Estado global de autenticação
- `PurchaseContext` - Estado de compras
- `DraftContext` - Estado de rascunhos

---

## Modelo de Dados (Supabase)

### Tabelas Principais
```sql
profiles          # Dados estendidos do usuário
supermarkets      # Estabelecimentos (CNPJ, nome, cidade, estado)
purchases         # Cabeçalho da compra (data, valor, chave NFC-e)
items             # Produtos comprados (nome, qtd, preço)
drafts            # Rascunhos de compras
```

### Stored Procedures
- `create_purchase_with_items` - Cria compra com itens em transação
- `report_expenses_by_supermarket` - Relatório por supermercado
- `report_top_items` - Top itens comprados

---

## Configurações de Segurança

### .gitignore
```
.env
.env.local
.env.*.local
mobile/.env
mobile/.env.local
mobile/.env.*.local
```

### Variáveis de Ambiente (.env.example)
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
NFCE_SCRAPER_URL=
```

### Row Level Security (RLS)
Todas as tabelas possuem RLS habilitado com políticas por `user_id`.

---

## Testes

### Cobertura Atual
- ✅ `authService.test.ts`
- ✅ `purchaseService.test.ts`
- ✅ `draftService.test.ts`
- ✅ `draftContent.test.ts`
- ✅ `nfceService.test.ts`
- ✅ `reportService.test.ts`
- ✅ `supermarketService.test.ts`
- ✅ `index.test.ts` (utils)
- ✅ `formatDate.test.ts`
- ✅ `formatMoney.test.ts`
- ✅ `nfceScraperScript.test.ts`

### Comandos
```bash
npm test           # Executar todos
npm run test:watch # Modo watch
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

---

## Próximas Tarefas

### Prioridade Alta
1. [ ] Categorização automática de produtos
2. [ ] Edição de itens individuais em compras
3. [ ] Melhorar cobertura de estados no scraping

### Prioridade Média
4. [ ] Alertas de variação de preço
5. [ ] Exportação PDF
6. [ ] Sincronização offline

### Infraestrutura
7. [ ] GitHub Releases
8. [ ] CI/CD pipeline
9. [ ] Testes E2E

---

## Notas Técnicas

### Incidente: Workflow CI Travado (Março 2026)
**Problema:** O workflow de release travava consistentemente no step "Build Android APK", causando timeouts e impedindo publicações automáticas.

**Causa Raiz:** Build Android completo gerava todos os ABIs (armeabi-v7a, arm64-v8a, x86, x86_64), resultando em tempo excessivo de compilação (~8-10min) e consumo de recursos no runner.

**Mitigação Aplicada (commit `b245fc9`):**
- Limitação de ABIs para produção: `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a`
- Redução de ~60% no tempo de build
- Eliminação de timeouts no CI
- APK v1.1.0 publicado manualmente como workaround

**Status:** Resolvido. Workflow otimizado operando normalmente.

---

### Pontos Fortes
- Arquitetura modular com serviços bem definidos
- Tipagem TypeScript completa
- Testes unitários configurados
- Separação clara de responsabilidades
- Helpers reutilizáveis extraídos
- Pipeline CI/CD otimizado e estável (v1.1.0)

### Pontos de Atenção
- Dependência de serviço externo para scraping (nfce-scraper)
- WebView scraping pode quebrar com mudanças nos portais SEFAZ
- Cobertura de testes pode ser expandida (screens, hooks)
- SEC-002 pendente: requer alteração no scraper externo para aceitar hashes

---

## 🚨 Status de Segurança

### Auditoria de Segurança - 06/03/2026

#### Vulnerabilidades Ativas

| ID | Componente | Severidade | Descrição | Status |
|----|------------|------------|-----------|--------|
| SEC-001 | `supabaseClient.ts` | 🔴 Crítica | Sessão armazenada em AsyncStorage (não criptografado) | ✅ Concluído (v1.0.4) |
| SEC-002 | `nfceService.ts` | 🟡 Alta | Chave NFC-e enviada em texto plano para scraper externo | ⏳ Pendente - requer alteração scraper |
| SEC-003 | `NFCeWebView.tsx` | 🟡 Alta | Dados do scraper injetados sem validação de schema | ✅ Concluído (v1.0.4) |
| SEC-004 | `supabase_schema.sql` | 🟡 Alta | `create_purchase_with_items` sem validação rigorosa de inputs | ✅ Concluído (v1.0.4) |
| SEC-005 | `nfceService.ts` | 🟡 Média | Whitelist de URLs valida apenas hostname | ✅ Concluído (v1.0.4) |

#### Resumo do Plano de Correção

**FASE 1 - Hotfixes (48h):**
- Migrar armazenamento de sessão para SecureStore
- Implementar hash de chaves NFC-e antes do envio
- Adicionar validação JSON Schema no WebView
- Reforçar whitelist de URLs

**FASE 2 - Hardening (7 dias):**
- Validações rigorosas na função SQL
- Cert pinning e TLS 1.3
- Content Security Policy no WebView
- Logging de segurança

**FASE 3 - Reforço (30 dias):**
- Pentest automatizado no CI/CD
- Cache criptografado de NFC-e
- Sandbox isolada para WebView
- Documentação e treinamento

#### Checklist de Implementação

**Fase 1 (Concluída em v1.0.4):**
- [x] SEC-001: SecureStore implementado
- [ ] SEC-002: Hash SHA-256 de chaves NFC-e (Pendente - requer alteração scraper)
- [x] SEC-003: Schema validation no WebView
- [x] SEC-005: URL validation reforçada
- [x] Testes de segurança passando

**Fase 2 (Planejada):**
- [x] SEC-004: Validações SQL implementadas (Concluído em v1.0.4)
- [ ] SEC-002: TLS 1.3 + cert pinning
- [ ] SEC-003: CSP headers configurados
- [ ] Sistema de logging de segurança
- [ ] Rotação automática de tokens

**Fase 3 (Planejada):**
- [ ] CI/CD com security scanning
- [ ] Cache criptografado local
- [ ] WebView sandboxed
- [ ] SECURITY.md publicado

#### Métricas de Segurança

| Indicador | Valor Atual | Meta |
|-----------|-------------|------|
| Vulnerabilidades Críticas | 0 | 0 |
| Vulnerabilidades Altas | 1 (SEC-002) | 0 |
| Dados sensíveis em texto plano | Parcial (apenas NFC-e) | Não |
| Cobertura de validação de entrada | 75% | 95% |

---

## Próximas Tarefas (Atualizado)

### Prioridade Crítica (Segurança)
1. [ ] **SEC-002:** Hash de chaves NFC-e antes do envio ao scraper (Fase 2)

### Prioridade Alta (Funcionalidades)
2. [ ] Categorização automática de produtos
3. [ ] Edição de itens individuais em compras
4. [ ] Melhorar cobertura de estados no scraping

### Prioridade Média
5. [ ] Alertas de variação de preço
6. [ ] Exportação PDF
7. [ ] Sincronização offline

### Infraestrutura
8. [ ] GitHub Releases automatizados
9. [x] CI/CD pipeline (Otimizado v1.1.0 - ABIs limitadas + Cache Gradle)
10. [ ] Testes E2E

---

*Documento atualizado em: 06/03/2026*
