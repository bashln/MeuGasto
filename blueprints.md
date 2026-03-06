# Blueprints - MeuGasto

## Visão Geral do Sistema
O **MeuGasto** é um ecossistema mobile-first para gestão inteligente de compras de supermercado. Ele automatiza a entrada de dados via leitura de NFC-e (Nota Fiscal de Consumidor Eletrônica) e fornece ferramentas de análise de gastos e organização.

### Objetivos Principais
1.  **Automação:** Reduzir a digitação manual de compras através do scanning de QR Code de NFC-e.
2.  **Transparência:** Fornecer relatórios detalhados de gastos por supermercado, categoria (planejado) e itens.
3.  **Histórico:** Manter um registro centralizado de preços e variações ao longo do tempo.
4.  **Escalabilidade:** Arquitetura Serverless pronta para evolução SaaS.

---

## Arquitetura Técnica

### Stack Tecnológica
-   **Frontend Mobile:** Expo (React Native) + TypeScript.
    -   UI: `react-native-paper` (Material Design).
    -   Navegação: `react-navigation`.
    -   Scanner: `expo-camera` + `react-native-webview` (para scraping).
-   **Backend (BaaS):** Supabase.
    -   Autenticação: Supabase Auth (Email/Senha).
    -   Banco de Dados: PostgreSQL.
    -   Segurança: Row Level Security (RLS) habilitado.
    -   Lógica: Stored Procedures (PL/pgSQL) acessadas via RPC.

### Fluxo de Dados de NFC-e
1.  **Captura:** O usuário escaneia o QR Code via `ScanQRCodeScreen`.
2.  **Extração de Chave:** O app extrai a chave de acesso de 44 dígitos via `extractAccessKeyFromQRCode()`.
3.  **Consulta (Estratégia Híbrida):**
    -   **API (Scraper Externo):** Tenta consultar `nfce-scraper.herokuapp.com` via `consultQRCode()`.
    -   **WebView Scraping:** Se a API falhar ou para estados específicos (ex: RS), abre um WebView oculto no portal da SEFAZ e executa um script JS para extrair os dados diretamente do DOM.
4.  **Persistência:** Os dados são enviados ao Supabase via RPC `create_purchase_with_items`.
5.  **Supermercado:** Busca inteligente por CNPJ via `findOrCreateSupermarket()` para evitar duplicatas.

### Organização do Código
```
mobile/src/
├── components/       # Componentes reutilizáveis (UI)
├── screens/          # Telas da aplicação
├── navigation/       # Configuração de navegação + tipos
│   └── types.ts      # RootStackParamList, MainTabParamList
├── services/         # Lógica de dados e APIs
│   ├── nfceService.ts        # NFC-e scraping e consulta
│   ├── purchaseService.ts    # CRUD de compras + mapPurchaseItems()
│   ├── supermarketService.ts # Gestão de supermercados
│   ├── draftService.ts       # Gestão de rascunhos
│   ├── reportService.ts      # Relatórios + buildDateRange()
│   └── authService.ts        # Autenticação
├── hooks/            # Custom hooks (useDashboard, useReports)
├── context/          # Contextos React (Auth, Purchase, Draft)
├── types/            # Tipos TypeScript globais
├── utils/            # Helpers e formatação
├── theme/            # Cores, spacing, typography
└── lib/              # Clientes externos (Supabase)
```

### Dashboard e Métricas
O DashboardScreen exibe:
- **HERO Card**: Gasto total do mês selecionado com badge de comparação (% vs mês anterior, incluindo cruzamento com dezembro do ano anterior).
- **Grid de Métricas**: Total de compras, itens únicos, economia estimada e ticket médio.
- **Insights Automáticos**: item com maior gasto, supermercado com maior gasto, contagem de compras.
- **Ações Rápidas**: Escanear cupom, Regra de 3 (compara preços), Relatórios detalhados.
- **Comparação Mensal**: Variação percentual calculada apenas com base em meses que possuem dados (sem dividir por zero).

---

## Modelo de Dados (Schema Supabase)

-   **`profiles`:** Dados estendidos do usuário (nome, cargo).
-   **`supermarkets`:** Cadastro de estabelecimentos (CNPJ, Nome, Cidade, Estado).
-   **`purchases`:** Cabeçalho da compra (Data, Valor Total, Chave de Acesso).
-   **`items`:** Detalhamento dos produtos comprados (Nome, Quantidade, Preço Unitário, Preço Total).
-   **`drafts`:** Rascunhos de compras ou itens pendentes de processamento.

## Fluxos de Navegação/Telas

-   `ForgotPasswordScreen`
-   `LoginScreen`
-   `RegisterScreen`
-   `DashboardScreen`
-   `PurchasesScreen`
-   `PurchaseDetailScreen`
-   `PurchaseEditScreen`
-   `DraftsScreen`
-   `DraftDetailScreen`
-   `ReportsScreen`
-   `ProfileScreen`
-   `EditProfileScreen`
-   `ScanQRCodeScreen`

---

## Roadmap e Status das Funcionalidades

### Fase 1: Fundação (Concluído ✅)
- [x] Configuração inicial Expo + Supabase.
- [x] Autenticação básica (Login/Cadastro).
- [x] Leitura de QR Code e extração de chave.
- [x] Persistência de compras manuais e via NFC-e.
- [x] Listagem e detalhes de compras.
- [x] Recuperação de senha via email.

### Fase 2: Refinamento e UX (Concluído ✅)
- [x] Filtros avançados na listagem de compras (busca textual + filtros: Todas/NFC-e/Manual).
- [x] Edição de compras manuais (Data, Total, Supermercado). Compras importadas via NFC-e permanecem read-only.
- [x] Listagem e gerenciamento de rascunhos (drafts) ativos.
- [x] Relatórios visuais com gráficos de evolução de gastos e exportação CSV.
- [x] Dashboard com comparação mensal, insights automáticos e ações rápidas.
- [x] Paginação/infinite scroll de compras dentro da aba Purchases.

### Fase 3: Inteligência e SaaS (Planejado 🚀)
- [ ] Categorização automática de produtos via IA/Regex.
- [ ] Alertas de variação de preços de itens frequentes.
- [ ] Compartilhamento de listas/compras entre usuários (família).
- [ ] Exportação de dados em PDF e novos formatos.
- [ ] Melhoria na resiliência do scraping de NFC-e (mais estados e fallback local).
- [ ] Edição de itens individuais dentro de uma compra.

### Testes
O projeto possui testes unitários configurados com Jest cobrindo serviços e utilitários.

```bash
cd mobile
npm test              # Executar todos os testes
npm run test:watch    # Modo watch
npm run typecheck     # Verificação de tipos TypeScript
npm run lint          # ESLint
```

**Cobertura atual:**
- `services/__tests__/` - Testes de serviços (auth, purchase, draft, nfce, report, supermarket)
- `utils/__tests__/` - Testes de utilitários (formatação, parsing)

---

## Guia para Desenvolvedores (Agentes)

### Convenções de Código
-   **Null Safety:** Obrigatório usar `?.` e `??`. Nunca assumir que dados do Supabase retornarão preenchidos.
-   **Services:** Toda lógica de dados deve estar em `mobile/src/services/`.
-   **Tipagem:** Manter `mobile/src/types/index.ts` atualizado com o schema do banco.

### Comandos de Verificação
-   Verificar tipos: `cd mobile && npx tsc --noEmit`
-   Executar app: `cd mobile && npm start`
-   Build Android: `cd mobile && npx expo run:android`

---

## Histórico de Versões

### v1.0.0 - Release Inicial (Março 2026)
**Status:** Em desenvolvimento

#### Novidades
- **Dashboard completo** com métricas em tempo real, comparação mensal e insights automáticos
- **Autenticação** com Supabase Auth (email/senha) e recuperação de senha
- **Captura NFC-e** via QR Code com estratégia híbrida (API externa + WebView scraping)
- **Gestão de compras** com filtros avançados, paginação e edição de compras manuais
- **Rascunhos (Drafts)** para compras em andamento com conversão automática
- **Relatórios visuais** com gráficos de evolução mensal e exportação CSV
- **Perfil de usuário** com edição de dados pessoais

#### Refatorações Recentes
- **Renomeação de tipos:** `Rascunho` → `Draft` (consistência com código)
- **Extração de helpers reutilizáveis:**
  - `findOrCreateSupermarket()` em `nfceService.ts` - busca inteligente por CNPJ
  - `mapPurchaseItems()` em `purchaseService.ts` - normalização de itens
  - `buildDateRange()` em `reportService.ts` - cálculo de períodos
- **Organização de tipos:** Tipos de navegação movidos para `navigation/types.ts`
- **Segurança:** `.gitignore` atualizado para proteger variáveis de ambiente

---

## Próximos Passos Planejados

### v1.1.0 - Melhorias de UX (Planejado)
- [ ] Categorização automática de produtos via regex/IA
- [ ] Alertas de variação de preços de itens frequentes
- [ ] Melhoria na resiliência do scraping (mais estados brasileiros)
- [ ] Edição de itens individuais dentro de uma compra

### v1.2.0 - Compartilhamento e SaaS (Planejado)
- [ ] Compartilhamento de listas/compras entre usuários (família)
- [ ] Exportação de dados em PDF
- [ ] Sincronização offline

### Infraestrutura
- [ ] Configurar GitHub Releases para versionamento automático
- [ ] CI/CD pipeline para builds automáticos
- [ ] Testes E2E com Detox

---

## 🔒 Plano de Correção de Segurança

**Auditoria realizada em:** 06/03/2026  
**Status:** Em implementação

### Resumo de Riscos Identificados

| ID | Vulnerabilidade | Severidade | Impacto |
|----|-----------------|------------|---------|
| SEC-001 | Sessão Supabase em AsyncStorage | 🔴 Crítica | Token acessível em storage não criptografado |
| SEC-002 | Envio de chave NFC-e para scraper externo | 🟡 Alta | Vazamento de dados fiscais do usuário |
| SEC-003 | WebView scraping sem sanitização | 🟡 Alta | Injeção de código via dados retornados |
| SEC-004 | Validação insuficiente em create_purchase_with_items | 🟡 Alta | Dados malformados podem corromper registros |
| SEC-005 | Whitelist de navegação por hostname apenas | 🟡 Média | Bypass via subdomínios ou paths maliciosos |

---

### 📋 Plano de Correção Faseado

#### FASE 1: Hotfixes Imediatos (48 horas)

**Objetivo:** Mitigar riscos críticos com impacto imediato na segurança.

| Item | ID | Ação | Prioridade | Esforço | Risco Reduzido |
|------|----|------|------------|---------|----------------|
| 1.1 | SEC-001 | Migrar AsyncStorage para SecureStore na sessão Supabase | P0 | 4h | Token inacessível sem root |
| 1.2 | SEC-002 | Implementar hash da chave NFC-e antes de envio ao scraper | P0 | 3h | Privacidade preservada |
| 1.3 | SEC-003 | Adicionar validação JSON Schema no retorno do WebView | P1 | 4h | Prevenção de injeção |
| 1.4 | SEC-005 | Reforçar whitelist com validação de path e protocolo | P1 | 2h | Bloqueio de navegação maliciosa |

**Critérios de Aceite Fase 1:**
- [ ] Tokens Supabase armazenados em SecureStore (expo-secure-store)
- [ ] Chaves NFC-e hasheadas (SHA-256) antes do envio ao scraper externo
- [ ] WebView valida estrutura dos dados via JSON Schema antes de processar
- [ ] Whitelist valida protocolo HTTPS, hostname E path permitidos
- [ ] Testes de segurança passam (injeção de scripts, tokens expostos)

**Artefatos a Modificar:**
```
mobile/src/lib/supabaseClient.ts          # SEC-001: SecureStore
mobile/src/services/nfceService.ts        # SEC-002: Hash de chaves
mobile/src/components/NFCeWebView.tsx     # SEC-003: Sanitização
mobile/src/utils/nfceValidator.ts         # SEC-003: Schema validation
mobile/src/services/nfceService.ts        # SEC-005: URL validation
```

---

#### FASE 2: Hardening (7 dias)

**Objetivo:** Implementar controles de segurança robustos e auditoria.

| Item | ID | Ação | Prioridade | Esforço | Risco Reduzido |
|------|----|------|------------|---------|----------------|
| 2.1 | SEC-004 | Adicionar validações rigorosas na função SQL create_purchase_with_items | P0 | 6h | Integridade dos dados |
| 2.2 | SEC-002 | Implementar criptografia de dados sensíveis em trânsito | P1 | 4h | Confidencialidade |
| 2.3 | SEC-003 | Content Security Policy no WebView | P1 | 3h | Mitigação XSS |
| 2.4 | Geral | Implementar logging de segurança | P2 | 4h | Auditoria e detecção |
| 2.5 | SEC-001 | Rotação automática de tokens | P2 | 3h | Minimizar janela de exposição |

**Critérios de Aceite Fase 2:**
- [ ] Função SQL valida: tamanho máximo de strings, ranges numéricos, formato de data
- [ ] Comunicação com scraper usa TLS 1.3 e cert pinning
- [ ] WebView com CSP restritivo (script-src 'none', connect-src 'self')
- [ ] Logs de segurança: tentativas de navegação bloqueadas, validações falhas
- [ ] Tokens rotacionados a cada 7 dias ou em eventos de segurança

**Artefatos a Modificar:**
```
mobile/supabase_schema.sql                # SEC-004: Validações SQL
mobile/src/services/nfceService.ts        # SEC-002: TLS/Cert pinning
mobile/src/components/NFCeWebView.tsx     # SEC-003: CSP headers
mobile/src/utils/securityLogger.ts        # Geral: Logging
mobile/src/lib/supabaseClient.ts          # SEC-001: Token rotation
```

---

#### FASE 3: Reforço e Documentação (30 dias)

**Objetivo:** Consolidar postura de segurança e documentação.

| Item | ID | Ação | Prioridade | Esforço | Risco Reduzido |
|------|----|------|------------|---------|----------------|
| 3.1 | Geral | Pentest automatizado no CI/CD | P1 | 8h | Detecção contínua |
| 3.2 | SEC-002 | Cache local de NFC-e (evita reenvio) | P2 | 6h | Redução de tráfego sensível |
| 3.3 | SEC-003 | Sandbox isolada para WebView | P2 | 8h | Containment |
| 3.4 | Geral | Documentação de segurança para devs | P2 | 4h | Conscientização |
| 3.5 | Geral | Treinamento de segurança (OWASP Mobile) | P3 | 4h | Prevenção proativa |

**Critérios de Aceite Fase 3:**
- [ ] Pipeline CI executa: dependency-check, SAST (Semgrep), secrets scanning
- [ ] NFC-e consultada uma única vez, cache criptografado localmente
- [ ] WebView executa em processo isolado (Android) / WKProcessPool (iOS)
- [ ] Guia de segurança para desenvolvedores publicado
- [ ] Checklist de segurança em PRs

**Artefatos a Modificar:**
```
.github/workflows/security.yml            # 3.1: CI Security
mobile/src/services/nfceCacheService.ts   # 3.2: Cache criptografado
mobile/src/components/NFCeWebView.tsx     # 3.3: Sandboxing
SECURITY.md                               # 3.4: Documentação
```

---

### 🔗 Dependências entre Tarefas

```
FASE 1 (48h)
├── SEC-001 [Bloqueia] → SEC-002, SEC-004
├── SEC-002 [Independente]
├── SEC-003 [Independente]
└── SEC-005 [Independente]

FASE 2 (7d)
├── SEC-004 [Depende SEC-001]
├── SEC-002-hardening [Depende SEC-002-hotfix]
├── SEC-003-csp [Depende SEC-003-validation]
├── Logging [Independente]
└── Token rotation [Depende SEC-001]

FASE 3 (30d)
├── Pentest [Depende FASE 1+2]
├── Cache [Depende SEC-002]
├── Sandbox [Depende SEC-003]
└── Docs [Independente]
```

---

### 📊 Métricas de Segurança

| Métrica | Baseline (06/03) | Meta Fase 1 | Meta Fase 2 | Meta Fase 3 |
|---------|------------------|-------------|-------------|-------------|
| Vulnerabilidades Críticas | 1 | 0 | 0 | 0 |
| Vulnerabilidades Altas | 3 | 2 | 0 | 0 |
| Dados sensíveis em texto plano | Sim | Não | Não | Não |
| Cobertura de validação de entrada | 30% | 60% | 90% | 95% |
| Tempo médio de detecção (MTTD) | N/A | N/A | 24h | 1h |

---

*Última atualização: 06/03/2026*
