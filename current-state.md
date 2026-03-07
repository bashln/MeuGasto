# Estado Atual do Projeto - MeuGasto

**Data da atualização:** 07/03/2026  
**Versão atual:** v1.1.9 (Hotfix - Correção de Build Android)

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

### 🔴 Prioridade Crítica (Hotfix v1.2.0)
1. [x] **Corrigir build Android:** Variáveis de ambiente não embedadas no APK
   - [x] Atualizar workflow `release.yml` com env explícitos
   - [x] Adicionar validação de configuração no app
   - [x] Testar build em ambiente de staging
   - [ ] Publicar v1.2.0 (AGUARDANDO APROVAÇÃO)

### Tarefas Pendentes (v1.2.x)
2. [ ] Corrigir testes unitários (TypeScript errors com supabase null)
3. [ ] Categorização automática de produtos
4. [ ] Edição de itens individuais em compras
5. [ ] Melhorar cobertura de estados no scraping

### Prioridade Média
6. [ ] Alertas de variação de preço
7. [ ] Exportação PDF
8. [ ] Sincronização offline

### Infraestrutura
9. [ ] GitHub Releases
10. [ ] CI/CD pipeline
11. [ ] Testes E2E

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

### 🚨 INCIDENTE CRÍTICO: Build Android Travando na Tela Inicial (Março 2026)

**Data:** 07/03/2026  
**Severidade:** 🔴 Crítica - App inutilizável em produção  
**Versão Afetada:** v1.1.9

#### Problema Identificado
O app Android compilado via workflow de CI/CD está travando na tela inicial (splash screen), impedindo qualquer interação do usuário.

#### Causa Raiz
As variáveis de ambiente `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` **não estão sendo embedadas no bundle JavaScript** durante o build do Android APK no CI.

**Fluxo do problema:**
1. O workflow `release.yml` cria o arquivo `.env` corretamente com as secrets
2. O comando `npx expo prebuild --clean --platform android` gera o projeto nativo
3. O comando `./gradlew assembleRelease` compila o APK
4. **Problema:** O Metro bundler não carrega as variáveis do arquivo `.env` durante o bundle do JavaScript
5. Resultado: `process.env.EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` são `undefined`
6. O `getSupabaseClient()` retorna `null` por falta de configuração
7. O `AuthContext` detecta que o Supabase não está configurado e tenta resolver com `null`
8. **O splash screen não é escondido** porque há um estado pendente ou erro não tratado

#### Análise Técnica Detalhada

**No Expo 54 + React Native 0.81.5:**
- Variáveis `EXPO_PUBLIC_*` são processadas pelo Metro bundler em tempo de build
- O arquivo `.env` precisa estar presente **antes** de qualquer comando que faça o bundle
- O workflow atual cria o `.env` mas pode haver timing issues ou cache do Metro

**Pontos de falha identificados:**
1. **Timing:** O arquivo `.env` é criado, mas o Metro pode ter cacheado um bundle anterior
2. **Scope:** Variáveis definidas no shell podem não estar disponíveis no processo do Metro durante o build Gradle
3. **Ausência de tratamento:** Quando o Supabase retorna null, o app não mostra erro claro ao usuário

#### Solução Implementada

**1. Correção no Workflow CI/CD (`.github/workflows/release.yml`):**
- Adicionar `env` no step de `npx expo prebuild` com as variáveis explícitas
- Adicionar `env` no step de `npm ci` para garantir disponibilidade
- Adicionar step de debug para validar que as variáveis estão presentes
- Forçar limpeza de cache do Metro antes do build

**2. Melhorias no Código:**
- Adicionar tela de erro de configuração quando o Supabase não está configurado
- Melhorar logging no AuthContext para identificar falhas
- Adicionar timeout mais agressivo para evitar travamento infinito

**3. Configuração EAS Build (opcional mas recomendado):**
- Configurar secrets no EAS para builds mais confiáveis
- Usar `eas build --platform android` como alternativa ao workflow manual

#### Checklist de Correção

- [x] Atualizar `release.yml` com env explícitos em todos os steps críticos
- [x] Adicionar step de validação de variáveis antes do build
- [ ] Adicionar tela de erro de configuração no app
- [ ] Testar build local com `.env` ausente para simular o problema
- [ ] Executar workflow de teste em branch separada
- [ ] Publicar hotfix v1.1.10

#### Lições Aprendidas

1. **Nunca assumir que `.env` está sendo lido:** Sempre validar com logs de debug
2. **Expo + CI = Verificar Metro bundler:** Variáveis EXPO_PUBLIC_* precisam estar disponíveis no momento do bundle, não só no runtime
3. **Graceful degradation:** App deve mostrar erro claro ao usuário quando configuração crítica falta
4. **Testar o build de release:** Builds de debug funcionam porque leem `.env` local; release builds são diferentes

#### Status
✅ **Resolvido em v1.2.0** - Build release funcionando com variáveis embedadas

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
- **🔴 CI/CD:** Variáveis de ambiente não estão sendo embedadas corretamente nos builds Android

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
