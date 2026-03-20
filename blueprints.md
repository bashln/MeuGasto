# Blueprint - Estrutura Atual do Projeto MeuGasto

## Visão Geral
Repositório centrado em um aplicativo mobile Expo/React Native em `mobile/`. O fluxo de build e release observado também parte de `mobile/`, com automação em `.github/workflows/release.yml`, bump manual em `.github/workflows/bump-dev-version.yml`, scripts locais em `mobile/scripts/` e projeto nativo Android gerado em `mobile/android/`.

## Estrutura Observável

```text
.
├── .github/workflows/           # Automação de release Android e bump manual de versão
├── android/                     # Placeholder histórico; o fluxo oficial não usa esta pasta
├── assets_backup/               # Diretório vazio observado
├── mobile/                      # Aplicativo Expo/React Native ativo
│   ├── App.tsx                  # Composição raiz do app
│   ├── index.ts                 # Registro do app Expo
│   ├── app.json                 # Configuração Expo e versionamento
│   ├── app.config.js            # Injeta config de ambiente em `expo.extra`
│   ├── package.json             # Scripts e dependências
│   ├── BUILD.md                 # Runbook de build Android
│   ├── supabase_schema.sql      # Referência de schema Supabase
│   ├── assets/                  # Ícones, splash e fontes locais
│   ├── plugins/                 # Config plugins Expo
│   ├── scripts/                 # Scripts locais de build/instalação Android
│   ├── android/                 # Projeto nativo Android gerado por prebuild
│   ├── dist/                    # Artefatos exportados observados
│   └── src/
│       ├── __tests__/           # Testes do bootstrap do app
│       ├── components/          # Componentes reutilizáveis e bridges de UI/plataforma
│       ├── context/             # Providers e estado compartilhado
│       ├── features/reports/    # Submódulo do domínio de relatórios
│       ├── hooks/               # Hooks de orquestração
│       ├── lib/                 # Infraestrutura e validações de baixo nível
│       ├── navigation/          # Navegação stack/tabs
│       ├── screens/             # Telas do app
│       ├── services/            # Acesso a dados e integrações
│       ├── theme/               # Tokens visuais
│       ├── types/               # Tipos compartilhados
│       └── utils/               # Utilitários gerais
├── README.md                    # Documentação geral
├── current-state.md             # Documento focado no estado atual de relatórios
└── blueprints.md                # Blueprint estrutural do repositório
```

## Pastas e Responsabilidades

### `.github/workflows`
- `release.yml` instala dependências de `mobile/`, sincroniza versão, executa `expo prebuild --clean --platform android`, compila APK em `mobile/android/` e publica release no GitHub.
- `bump-dev-version.yml` isola o bump de versão da branch `dev` e a abertura de PR para depois do release.

### `android`
- A pasta contém apenas documentação local e não participa do fluxo oficial de build.
- O projeto Android efetivamente usado pelo app fica em `mobile/android/`.

### `assets_backup`
- Diretório vazio observado na raiz do repositório.

### `mobile`
- Concentra o aplicativo ativo e os arquivos de configuração de runtime/build.
- `app.config.js` expõe `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` em `expo.extra`.
- `BUILD.md` documenta o fluxo de build Android local.
- `supabase_schema.sql` mantém uma referência de schema do banco.
- `android/` contém o projeto nativo Android gerado; `dist/` contém artefatos exportados observados.

### `mobile/src/components`
- Exporta componentes reutilizáveis como `Header`, `Loading`, `ErrorMessage`, `PurchaseCard`, `DraftCard`, `MonthYearPicker`, `PriceComparisonCard` e `ItemInputRow`.
- Também contém componentes que encapsulam integração com APIs/plataforma, como `QRCodeScanner`, `NFCeWebView` e `UpdateDialog`.
- `AppBootScreen` responde pelo branding/loading inicial.
- Há testes em `mobile/src/components/__tests__/`.

### `mobile/src/context`
- `AuthContext.tsx`: bootstrap de autenticação, controle de onboarding, observação de sessão e atualização do usuário autenticado.
- `PurchaseContext.tsx`: listagem paginada de compras, carregamento incremental e mutações de compra.
- `DraftContext.tsx`: listagem paginada de rascunhos, CRUD e conversão de rascunho em compra.
- `index.ts` reexporta providers e hooks públicos.

### `mobile/src/features/reports`
- Submódulo explícito para o domínio de relatórios.
- `components/`: `PeriodFilter`, `InsightsBlock`, `PriceHistoryChart`, `MarketRanking` e seções públicas consumidas por `ReportsScreen`.
- `hooks/`: `useReports`, `useReportsScreenModel` e `useReportInsights`.
- `utils/`: `periodUtils` e `priceUtils`.
- `types.ts`: tipos do domínio de relatórios.
- `index.ts`: fronteira pública do submódulo, reexportando hooks e componentes usados pela tela.
- Há testes em `components/__tests__`, `hooks/__tests__` e `utils/__tests__`.

### `mobile/src/hooks`
- `useDashboard.ts`: carrega estatísticas do dashboard, top itens, gastos por mercado e séries mensais.
- `useReports.ts`: wrapper de compatibilidade que reexporta o hook público de `features/reports`.
- `useUpdateCheck.ts`: checa atualização do app e expõe estado para o diálogo de update.
- `index.ts` reexporta hooks públicos.

### `mobile/src/lib`
- Infraestrutura e utilitários de baixo nível.
- `supabaseClient.ts`: resolve configuração do Supabase via `process.env`/`expo.extra` e instancia o cliente com persistência segura.
- `secureSessionStorage.ts`: persistência segura de sessão.
- `csvSecurity.ts`: sanitização para exportação CSV.
- `nfcePayloadValidation.ts`: validação e saneamento de payload de NFC-e.
- Há testes em `mobile/src/lib/__tests__/`.

### `mobile/src/navigation`
- `AppNavigator.tsx` define a navegação principal com stack + bottom tabs.
- Decide entre boot screen, onboarding, autenticação e rotas autenticadas.
- `types.ts` contém os tipos de navegação.
- `index.ts` reexporta o navigator e os tipos.

### `mobile/src/screens`
- `screens/index.ts` reexporta as telas do app.
- Estrutura observável:
  - autenticação: `LoginScreen`, `RegisterScreen`, `ForgotPasswordScreen`
  - onboarding: `OnboardingScreen`
  - dashboard: `DashboardScreen`
  - compras: `PurchasesScreen`, `PurchaseDetailScreen`, `PurchaseEditScreen`
  - rascunhos: `DraftsScreen`, `DraftDetailScreen`
  - relatórios: `ReportsScreen`
  - perfil: `ProfileScreen`, `EditProfileScreen`
  - captura/comparação: `ScanQRCodeScreen`, `PriceComparatorScreen`
- Há testes em `mobile/src/screens/__tests__/`.

### `mobile/src/services`
- Camada de acesso a dados e integrações, reexportada por `services/index.ts`.
- Serviços observáveis:
  - `authService.ts`: autenticação, sessão, recuperação de senha e atualização de perfil.
  - `purchaseService.ts`: operações de compras.
  - `supermarketService.ts`: consulta de supermercados.
  - `draftService.ts`: CRUD e conversão de rascunhos.
  - `reportService.ts`: estatísticas de dashboard, séries mensais, top itens, ranking de mercados, relatório de item e histórico de preços.
  - `nfceService.ts`: parsing/validação de QR Code NFC-e, montagem de URLs seguras e criação de compra a partir de scraping.
  - `updateService.ts`: checagem de releases no GitHub, cache local e download de APK.
  - `onboardingService.ts`: persistência local do estado de onboarding.
  - `draftContent.ts`: serialização/manipulação de conteúdo estruturado de rascunhos.
- Há testes em `mobile/src/services/__tests__/`.

### `mobile/src/theme`
- Tokens visuais compartilhados: `colors.ts`, `spacing.ts`, `typography.ts`.
- `typography.ts` centraliza a família tipográfica usada pelo app.

### `mobile/assets`
- Armazena ícones, splash e fontes locais empacotadas pelo app.
- A família tipográfica observável carregada localmente é `IBM Plex Serif`, via `mobile/assets/fonts/`.

### `mobile/src/types`
- Tipos compartilhados de autenticação, compras, rascunhos, paginação e dashboard.
- Também contém `react-test-renderer.d.ts` para suporte de testes.

### `mobile/src/utils`
- Utilitários gerais exportados por `utils/index.ts`: `formatMoney`, `formatDate` e `priceComparison`.
- `nfceScraperScript.ts` mantém o script auxiliar de scraping usado no fluxo de NFC-e.
- Há testes em `mobile/src/utils/__tests__/`.

### `mobile/plugins`
- Contém `withAndroidSigning.js`, usado como config plugin para ajuste de assinatura Android.

### `mobile/scripts`
- Scripts locais para build, instalação e abertura de APK/debug Android em dispositivo.

### `mobile/android`
- Projeto nativo Android observado com `MainActivity.kt`, `MainApplication.kt`, manifesto e recursos de launcher/splash.
- É o diretório usado pelo workflow de release e pelos scripts locais de build.

### `mobile/dist`
- Diretório de artefatos exportados observado, com `_expo/`, `assets/` e `metadata.json`.

## Fluxo Principal Observável

1. `mobile/index.ts` registra `mobile/App.tsx` como raiz do aplicativo Expo.
2. `mobile/App.tsx` monta `SafeAreaProvider`, `PaperProvider`, `UpdateChecker` e os providers de `Auth`, `Purchase` e `Draft`.
3. `mobile/src/navigation/AppNavigator.tsx` decide entre `AppBootScreen`, onboarding, fluxo de autenticação ou navegação autenticada.
4. O fluxo autenticado organiza tabs principais (`Dashboard`, `Compras`, `Rascunhos`, `Relatórios`, `Perfil`) e telas extras em stack.
5. `screens/` orquestram hooks, contexts, services e components; `services/` e `lib/` concentram acesso a Supabase, SecureStore, GitHub Releases e validações auxiliares.

## Invariantes Arquiteturais Ativos

- O aplicativo ativo do repositório está concentrado em `mobile/`.
- O entry point do app é `mobile/App.tsx`, registrado por `mobile/index.ts`.
- A árvore principal do app é envolvida por `AuthProvider`, `PurchaseProvider` e `DraftProvider`, dentro de `SafeAreaProvider` e `PaperProvider`.
- A navegação principal está definida em `mobile/src/navigation/AppNavigator.tsx`.
- O domínio de relatórios está isolado em `mobile/src/features/reports/`, com `index.ts` como fronteira pública consumida por `ReportsScreen`.
- O build/release Android observado opera sobre `mobile/android/`, não sobre a pasta `android/` da raiz.
- A configuração do Supabase é resolvida a partir de `process.env` e/ou `expo.extra`, via `mobile/app.config.js` e `mobile/src/lib/supabaseClient.ts`.
- Testes aparecem majoritariamente próximos aos módulos, em diretórios `__tests__/`.
- Nem todos os componentes são puramente visuais: `UpdateDialog`, `QRCodeScanner` e `NFCeWebView` encapsulam interação com APIs/plataforma.
- `updateService` consulta GitHub Releases e usa `expo-secure-store`/`expo-file-system`; nem toda integração passa por Supabase.

## Invariantes Não Definidos

- Não há, no código observado, um documento versionado que imponha camadas obrigatórias, regras formais de dependência entre pastas ou restrições explícitas de import.
- A pasta `android/` da raiz está documentada apenas como placeholder histórico e não como árvore de build ativa.

## Tipos e Interfaces Relevantes

### `mobile/src/features/reports/types.ts`
- Define tipos do domínio de relatórios, incluindo opções de período, insights e ranking de mercados.

### `mobile/src/navigation/types.ts`
- Define os parâmetros das rotas de stack e tabs.

### `mobile/src/types/index.ts`
- Define tipos compartilhados de autenticação, compras, rascunhos, paginação e dashboard.

### `mobile/src/lib/supabaseClient.ts`
- Define `ResolvedSupabaseConfig`, usado para representar a origem e a validade da configuração Supabase.

### `mobile/src/services/updateService.ts`
- Define `UpdateInfo`, contrato usado pelo fluxo de atualização in-app.

## Tecnologias Observáveis

- Expo
- React Native
- TypeScript
- React Navigation
- React Native Paper
- Supabase
- Jest
- GitHub Actions
- `expo-secure-store`
- `expo-file-system`
- `expo-font`
- `expo-camera`
- `expo-splash-screen`
- `react-native-webview`
- `react-native-gifted-charts`
- `date-fns`

## Seções Ajustadas

- Visão geral do repositório
- Estrutura observável da raiz e de `mobile/`
- Responsabilidades de pastas/módulos principais
- Fluxo principal do app
- Invariantes arquiteturais observáveis
- Tipos/interfaces e tecnologias observáveis
