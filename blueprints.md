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

*Última atualização: 06/03/2026*
