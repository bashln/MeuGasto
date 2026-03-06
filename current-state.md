# Estado Atual do Projeto - MeuGasto

**Data da atualização:** 06/03/2026  
**Versão atual:** v1.0.0 (em desenvolvimento)

---

## Visão Geral

O MeuGasto é um aplicativo mobile para gestão de compras de supermercado com foco em automação via leitura de NFC-e (Nota Fiscal de Consumidor Eletrônica).

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

### Pontos Fortes
- Arquitetura modular com serviços bem definidos
- Tipagem TypeScript completa
- Testes unitários configurados
- Separação clara de responsabilidades
- Helpers reutilizáveis extraídos

### Pontos de Atenção
- Dependência de serviço externo para scraping (nfce-scraper)
- WebView scraping pode quebrar com mudanças nos portais SEFAZ
- Cobertura de testes pode ser expandida (screens, hooks)

---

*Documento atualizado em: 06/03/2026*
