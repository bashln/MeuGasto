# Repository Analysis - MeuGasto

## Overview
O **MeuGasto** é uma aplicação mobile (Expo/React Native) integrada ao Supabase para gestão inteligente de compras. O diferencial técnico reside na automação da entrada de dados via processamento de NFC-e (estratégia híbrida de API externa e WebView scraping).

## Structure
A estrutura segue uma organização modular por responsabilidades:
- **`mobile/src/screens/`**: Camada de apresentação e orquestração de UI.
- **`mobile/src/services/`**: Camada de lógica de negócio e persistência (encapsula chamadas ao Supabase e APIs externas).
- **`mobile/src/context/`**: Gerenciamento de estado global (Auth, Purchases, Drafts).
- **`mobile/src/components/`**: UI components reutilizáveis.
- **`mobile/src/lib/`**: Configurações de clientes (Supabase) e validações core.
- **`supabase/`**: Lógica de banco de dados (RLS, RPCs, Stored Procedures).

## Hotspots
1.  **`mobile/src/services/nfceService.ts`**: Concentra lógica complexa de parsing de QR Code, roteamento por estado (SEFAZ), consulta a API externa e fallback de scraping.
2.  **`mobile/src/components/NFCeWebView.tsx`**: Ponto crítico de integração que depende da estrutura volátil dos portais da SEFAZ.
3.  **`supabase_schema.sql` (Stored Procedure `create_purchase_with_items`)**: Transação crítica que garante a integridade entre Compras e Itens.
4.  **`mobile/src/context/PurchaseContext.tsx`**: Centraliza o estado de compras e pode se tornar um gargalo de performance com o crescimento da lista.

## Risks
-   **Dependência Externa**: Forte acoplamento com o `nfce-scraper` e portais da SEFAZ. Mudanças nestes serviços podem quebrar a funcionalidade principal.
-   **Segurança (SEC-002)**: Envio de chaves NFC-e em texto plano para scraper externo. Necessário implementar hashing/tokenização conforme planejado.
-   **Consistência de Dados**: O mapeamento de supermercados via CNPJ (`findOrCreateSupermarket`) é propenso a duplicatas se os dados retornados pelo scraper forem inconsistentes.
-   **Performance**: O dashboard realiza agregações que, conforme o volume de dados cresce, podem exigir otimização no lado do servidor (views ou funções calculadas).

## Invariants
-   Todas as operações de escrita no banco devem passar por Row Level Security (RLS).
-   Compras importadas via NFC-e são somente leitura (integridade fiscal).
-   Toda lógica de dados deve residir em `services/`, não em `screens/`.
-   Validação de schema obrigatória para dados provenientes de fontes externas (WebView/API).

## Recommended Next Steps
1.  **Categorização IA**: Iniciar a fase 3 (Inteligência) com categorização automática para melhorar os relatórios, agora que o pipeline de release está estável.
2.  **Refatoração do `nfceService.ts`**: Extrair a lógica de supermercados para o `supermarketService.ts` para reduzir o acoplamento.
3.  **Segurança (SEC-002)**: Priorizar a implementação do hash de chaves NFC-e.
4.  **Testes de Integração**: Implementar testes E2E (Detox) para validar o fluxo completo desde o QR Code até a persistência no Supabase.
