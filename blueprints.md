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
2.  **Extração de Chave:** O app extrai a chave de acesso de 44 dígitos.
3.  **Consulta (Estratégia Híbrida):**
    -   **API (Scraper Externo):** Tenta consultar `nfce-scraper.herokuapp.com`.
    -   **WebView Scraping:** Se a API falhar ou para estados específicos (ex: RS), abre um WebView oculto no portal da SEFAZ e executa um script JS para extrair os dados diretamente do DOM.
4.  **Persistência:** Os dados (Supermercado, Itens, Data, Valor) são enviados ao Supabase via RPC `create_purchase_with_items`.

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

### Fase 2: Refinamento e UX (Em Progresso 🏃)
- [ ] Implementação de filtros avançados na listagem de compras.
- [ ] Edição parcial de compras (Data, Total, Supermercado) e itens (Planejado).
- [ ] Relatórios visuais (Gráficos de evolução de gastos).
- [ ] Melhoria na resiliência do scraping de NFC-e (suporte a mais estados).

### Fase 3: Inteligência e SaaS (Planejado 🚀)
- [ ] Categorização automática de produtos via IA/Regex.
- [ ] Alertas de variação de preços de itens frequentes.
- [ ] Compartilhamento de listas/compras entre usuários (família).
- [ ] Exportação de dados (CSV/JSON).

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

*Última atualização: 04/03/2026*
