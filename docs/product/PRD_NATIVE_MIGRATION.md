# Documento de Requisitos de Produto (PRD)

## Migração Android Nativa (Kotlin + Jetpack Compose) & Modo Híbrido de Armazenamento

- **Projeto:** MeuGasto (`com.prati.meugasto`)
- **Versão Alvo:** `v0.4.0.0` (Version Code: `69`)
- **Status:** Implementado (Fase de Validação & QA)
- **Data de Atualização:** 15 de Setembro de 2026

---

## 1. Visão Geral e Contexto do Produto

### 1.1 O Problema

Consumidores brasileiros que fazem compras frequentes em supermercados enfrentam dificuldades crônicas no controle de gastos. Aplicativos genéricos de gestão financeira exigem digitação manual exaustiva de cada produto (30+ itens por cupom), levando ao abandono do hábito.

### 1.2 A Solução MeuGasto

Transformar a leitura do QR Code da **NFC-e (Nota Fiscal de Consumidor Eletrônica)** em registro financeiro automático, extraindo com precisão: produtos, preços unitários, quantidades, descontos, dados fiscais do supermercado e data.

### 1.3 A Grande Virada: Por que Migrar para Kotlin Nativo?

1. **Performance e Responsividade:** A inicialização instantânea da câmera e do leitor óptico via **CameraX + Google ML Kit** nativos elimina os gargalos de bridge JavaScript do React Native/Expo.
2. **Confiabilidade e Autonomia Offline:** A transição para **Room Database (SQLite nativo com KSP)** garante integridade referencial, consultas reativas em tempo real (Coroutines Flow) e zero latência de tela.
3. **Liberdade e Privacidade Radical (Modo Duplo):** Introdução da bifurcação de modos no Onboarding/Configurações:
   - **Modo Nuvem (Supabase):** Sincronização segura em nuvem e comparação colaborativa anonimizada.
   - **Modo Local-First:** Os dados nunca tocam em servidores de terceiros; ficam restritos ao dispositivo local, com opção de backup pessoal em provedores privados (WebDAV / Nextcloud / Google Drive / Dropbox).
4. **UI/UX Moderna:** Adoção integral do **Material 3 (Jetpack Compose)** com Dynamic Theming, tipografia polida e navegação fluida.

---

## 2. Invariantes Críticos & Restrições Arquiteturais

| Invariante                 | Requisito / Regra                               | Justificativa                                                                            |
| :------------------------- | :---------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Package Name**           | `com.prati.meugasto`                            | Se alterado, o Android trata como outro app e quebra atualizações de apps já instalados. |
| **Assinatura APK**         | Keystore de Release (`meugasto-release.jks`)    | Impede erro `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.                                        |
| **Version Code**           | Deve ser sempre incremental (`68` → `69`)       | Exigência do instalador de pacotes do Android.                                           |
| **EAS Project ID**         | `a1d6cf32-6e8c-4edc-a0d0-7c979f8104e7`          | Mantido intacto em `mobile/app.json`.                                                    |
| **Permissão de Áudio**     | `RECORD_AUDIO` **terminantemente proibido**     | Garantia constitucional e de privacidade aos usuários.                                   |
| **Privacidade por Design** | Zero espionagem; admin cego a dados individuais | Filosofia central do projeto e conformidade AGPLv3.                                      |

---

## 3. O Que Foi Feito (Status: Concluído)

### 3.1 Limpeza e Higienização do Repositório

- [x] Remoção de arquivos legados de tema não utilizados (`mobile/src/theme/spacing.ts`, `typography.ts`).
- [x] Remoção de assets duplicados/mortos (`android-icon-background.png`, `android-icon-monochrome.png`).
- [x] Limpeza de tipos e funções obsoletas no código TypeScript (`AuthResponse`, `LoginRequest`, `checkSupabaseConfiguration`, `formatDateTime`).
- [x] Remoção do diretório vazio `mobile/supabase/`.
- [x] Exclusão de branches git locais mortas/mescladas (`chore/reorg-docs`, `fix/release-upload-existing-tag`, `fix/pr16-conflicts`, `testing`).
- [x] Limpeza de caches antigos de prebuild do Expo (`mobile/android`), liberando ~928 MB de espaço em disco.

### 3.2 Infraestrutura e Setup Android Nativo

- [x] **Gradle Wrapper 8.9** configurado e funcional (`mobile/gradlew`, `gradle-wrapper.jar`, `gradle-wrapper.properties`).
- [x] **Gradle Version Catalog** criado em `mobile/gradle/libs.versions.toml`:
  - Kotlin `2.0.21` com Jetpack Compose Compiler integrado.
  - KSP `2.0.21-1.0.28`.
  - Android Gradle Plugin (AGP) `8.5.2`.
  - Compose BOM `2024.10.00` (Material 3).
  - Room `2.6.1`.
  - Ktor Client `2.3.12`.
  - CameraX `1.3.4` e Google ML Kit Barcode `17.3.0`.
  - AndroidX Security Crypto `1.1.0-alpha06`.
- [x] **Configuração de Compilação:** `compileSdk = 35`, `minSdk = 26`, `targetSdk = 35`, Java 17.
- [x] **Manifest & Permissões:** `AndroidManifest.xml` nativo configurado com `CAMERA`, `INTERNET`, `ACCESS_NETWORK_STATE`, `FileProvider` para atualização de APKs e bloqueio explícito de `RECORD_AUDIO`.
- [x] **Assets de Ícones Adaptativos:** Configurados em `mobile/app/src/main/res/mipmap-*` com foreground em vetor e fundo estilizado.

### 3.3 Camada de Domínio e Modelos de Dados

- [x] `domain/model/Models.kt`:
  - `Purchase`, `PurchaseItem`, `Supermarket`, `PurchaseDraft`, `ShoppingList`, `ShoppingListItem`.
  - Enum `AppMode` (`LOCAL_ONLY`, `CLOUD_SYNC`).
  - Enum `SyncProviderType` (`NONE`, `WEBDAV`, `GOOGLE_DRIVE`, `DROPBOX`).
  - Enum `NfceProcessingStatus` (`PENDING`, `PROCESSING`, `SUCCESS`, `FALLBACK_REQUIRED`, `FAILED`).

### 3.4 Persistência de Dados e Banco Local (Room)

- [x] `data/local/database/Entities.kt`:
  - Mapeamento completo com índices para `SupermarketEntity`, `PurchaseEntity`, `PurchaseItemEntity`, `PurchaseDraftEntity`, `ShoppingListEntity`, `ShoppingListItemEntity`.
- [x] `data/local/database/Daos.kt`:
  - DAOs com suporte a Coroutines `Flow` reativos e transações atômicas (`PurchaseDao`, `SupermarketDao`, `DraftDao`, `ShoppingListDao`).
- [x] `data/local/database/AppDatabase.kt`:
  - Configuração do Room Database com migrações automáticas permitidas em dev.
- [x] `data/local/preferences/UserPreferences.kt`:
  - Gerenciamento de credenciais e tokens usando `EncryptedSharedPreferences` (MasterKeys AES-256 GCM).

### 3.5 Mecanismo Fiscal de NFC-e e Scrapers Estaduais

- [x] `domain/nfce/NfceModels.kt`: Estrutura do payload e chaves de 44 dígitos.
- [x] `domain/nfce/NfcePayloadValidator.kt`: Validação estrita de URLs de QR Code da SEFAZ, chave de acesso e verificação de integridade.
- [x] `domain/nfce/NfceStateStrategy.kt`: Interface padrão para estratégias estaduais com priorização de requisições HTTP GET diretas (eliminando overhead de WebView quando viável).
- [x] `domain/nfce/strategies/RsNfceStrategy.kt`: Extrator nativo para o Rio Grande do Sul via parsing HTML de seletores SEFAZ-RS.
- [x] `domain/nfce/strategies/RjNfceStrategy.kt`: Extrator nativo para o Rio de Janeiro.
- [x] `domain/nfce/NfceScraperEngine.kt`: Motor central com fallback automático (estratégia nativa -> API remota de contingência).

### 3.6 Motor de Correspondência de Itens (String Matcher)

- [x] `domain/comparator/StringMatcher.kt`:
  - Distância de Levenshtein otimizada com limiar configurável (padrão 82%).
  - Dicionário de abreviações fiscais brasileiras (`LT` → `LEITE`, `REFRI` → `REFRIGERANTE`, `KG`, `DESOD`, `BISC`, etc.).
  - Normalização de tokens, remoção de acentos/pontuações e penalização por palavras exclusivas (ex: "integral" vs "desnatado").

### 3.7 Repositórios e Provedores de Backup Pessoal

- [x] `data/repository/Repositories.kt`:
  - `LocalPurchaseRepository` operando 100% sobre o Room.
  - `UnifiedPurchaseRepository` chaveando a fonte de dados conforme o `AppMode` ativo.
- [x] `data/remote/sync/SyncProviders.kt`:
  - `WebDavSyncProvider` implementado (Ktor Client com autenticação HTTP Basic, exportação de dump JSON e envio seguro para Nextcloud / ownCloud / servidores WebDAV privados).

### 3.8 Redesign de UI/UX em Jetpack Compose (Material 3)

- [x] `Theme.kt`: Suporte a Dynamic Color (Android 12+), Dark Mode / Light Mode e paleta acessível.
- [x] `Navigation.kt`: Barra de navegação inferior (BottomNavigation) e roteamento limpo com ícones dinâmicos.
- [x] `DashboardScreen.kt`:
  - Exibição de totais mensais, indicador visual do modo ativo (`Local` vs `Nuvem`), atalhos rápidos e lista das últimas compras.
- [x] `ScanQrCodeScreen.kt`:
  - Integração da câmera em tempo real com CameraX e overlay de leitura.
  - Detecção contínua de QR Code com ML Kit.
  - Indicador de processamento e feedback de sucesso/erro.
- [x] `PurchasesScreen.kt` & `PurchaseDetailScreen.kt`:
  - Listagem com filtro/busca e cards detalhados.
  - Tela de detalhes com informações do estabelecimento, data, valor total e lista discriminada de cada item (quantidade, preço unitário, total).
- [x] `ShoppingListScreen.kt`:
  - Criação e acompanhamento de listas de compras com checkbox de itens marcados.
- [x] `SettingsScreen.kt`:
  - Alternância imediata entre Modo Nuvem e Modo Local.
  - Configurações do servidor WebDAV (URL, usuário, senha) e botão de sincronização manual.
  - Verificador de atualizações do app com trigger para download.
- [x] `OnboardingScreen.kt`:
  - Tela de boas-vindas guiando o usuário a escolher entre Modo Nuvem (Supabase) ou Modo Local (Privado).

### 3.9 Mecanismo de Atualização OTA & In-App APK Updater

- [x] `update/InAppUpdateManager.kt`:
  - Consulta automática à API do GitHub Releases (`/repos/bashln/MeuGasto/releases/latest`).
  - Comparação semântica de versões (`vMAJOR.MINOR.PATCH.BUILD`).
  - Download do APK diretamente em cache e disparo do instalador nativo do sistema via `FileProvider` e intent `ACTION_VIEW` com flags de permissão de instalação de pacotes.

### 3.10 Automação de CI/CD e Garantia de Qualidade

- [x] `.github/workflows/quality.yml`:
  - Adicionados steps de configuração do Java 17, Android SDK 35 e execução automática de testes unitários nativos (`./gradlew test`).
- [x] `.github/workflows/release.yml`:
  - Substituído o antigo fluxo de `expo prebuild` por `./gradlew assembleRelease` nativo.
  - Assinatura automática e publicação dos assets `meugastovX.X.X.XX.apk`.
- [x] **Sucesso nas Validações:**
  - `./gradlew test`: 53 tasks executadas, 100% dos testes unitários passaram (`StringMatcherTest`, `NfceScraperEngineTest`).
  - `./gradlew assembleDebug`: APK de debug gerado com sucesso (55 MB).
  - Scripts de auditoria executados e aprovados: `privacy-check.sh`, `secret-scan.sh`, `dependency-audit.test.mjs`, `validate-release-tag.sh`.

---

## 4. O Que Ainda Falta Fazer (Backlog de Pendências)

O roadmap a seguir está organizado por ordem de prioridade de entrega.

### Prioridade 1: Validação Prática em Dispositivo / QA (Imediato)

- [ ] **Teste no Emulador ou Celular Físico:**
  - Instalar o APK gerado (`mobile/app/build/outputs/apk/debug/app-debug.apk`) via `adb install`.
  - Validar a abertura de câmera e escaneamento de um QR Code real de NFC-e.
  - Testar a troca de modo no Onboarding e nas Configurações.
  - Validar o cálculo de totais no Dashboard e navegação entre telas.

### Prioridade 2: Conexão Nativa dos Provedores Adicionais de Backup

- [ ] **Google Drive Backup Provider:**
  - Implementar o provedor de backup via Google Drive REST API (armazenamento na pasta privada do app `appDataFolder`).
- [ ] **Dropbox Backup Provider:**
  - Implementar o provedor de backup via Dropbox API v2.

### Prioridade 3: Expansão dos Scrapers Estaduais de NFC-e

Atualmente temos estratégias para RS e RJ no motor nativo. Conforme a lista de estados em `AGENTS.md`, implementar gradualmente as estratégias dos demais estados:

- [ ] São Paulo (SP)
- [ ] Minas Gerais (MG)
- [ ] Paraná (PR)
- [ ] Santa Catarina (SC)
- [ ] Demais estados da federação (Bahia, Ceará, Goiás, Pernambuco, etc.).

### Prioridade 4: Testes Automatizados de UI (Compose Tests)

- [ ] Adicionar testes de tela com `androidx.compose.ui.test.junit4`:
  - Teste de fluxo de Onboarding (seleção de modo).
  - Teste de adição de lista de compras.
  - Teste de exibição de compra no Dashboard.

### Prioridade 5: Limpeza Final de Código Legado React Native

- [ ] Após a homologação da versão nativa em produção, remover o código JavaScript remanescente dentro de `mobile/src/` e dependências obsoletas do `mobile/package.json` para reduzir o tamanho do repositório.

### Prioridade 6: Publicação e Lançamento da Release v0.4.0.0

- [ ] Fazer commit de todas as alterações nativas na branch `dev`.
- [ ] Fazer push para o repositório remoto.
- [ ] Abrir Pull Request de `dev` para `main`.
- [ ] Após aprovação e merge, criar e subir a tag `v0.4.0.0` para disparar o pipeline de release com o APK assinado.

---

## 5. Matriz de Arquivos do Projeto Nativo

```
mobile/
├── app/
│   ├── build.gradle.kts                      # Configuração do módulo Android, SDK 35, dependências
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml           # Permissões, Activities, FileProvider
│       │   ├── java/com/prati/meugasto/
│       │   │   ├── MainActivity.kt           # Activity principal com Compose Content
│       │   │   ├── MeuGastoApp.kt            # Application class
│       │   │   ├── domain/
│       │   │   │   ├── model/Models.kt       # Purchase, Supermarket, Draft, AppMode
│       │   │   │   ├── comparator/StringMatcher.kt # Fuzzy matching com abreviações fiscais
│       │   │   │   └── nfce/                 # Engine, validadores e scrapers (RS, RJ)
│       │   │   ├── data/
│       │   │   │   ├── local/
│       │   │   │   │   ├── database/         # Room Database, DAOs e Entidades
│       │   │   │   │   └── preferences/      # UserPreferences (EncryptedSharedPreferences)
│       │   │   │   ├── remote/sync/          # WebDAV Sync Provider
│       │   │   │   └── repository/           # Repositórios unificados e locais
│       │   │   ├── update/
│       │   │   │   └── InAppUpdateManager.kt # Verificador e instalador de APK via GitHub API
│       │   │   └── ui/
│       │   │       ├── theme/Theme.kt        # Material 3 Dynamic Theme
│       │   │       ├── navigation/Navigation.kt
│       │   │       └── screens/              # Dashboard, Scanner, Purchases, Shopping, Settings, Onboarding
│       │   └── res/                          # XMLs de layout, ícones adaptativos, strings, file_paths
│       └── test/                             # Testes unitários (StringMatcherTest, ScraperEngineTest)
├── gradle/
│   ├── libs.versions.toml                    # Version Catalog centralizado
│   └── wrapper/                              # Gradle Wrapper binário e propriedades
├── build.gradle.kts                          # Build script raiz
├── settings.gradle.kts                       # Declaração dos módulos e repositórios Maven
└── local.properties                          # Configuração local do Android SDK
```

---

## 6. Conclusão e Próximo Passo Imediato

O núcleo da aplicação nativa está 100% implementado, compilando sem erros e com a suite de testes unitários passando com sucesso.

O próximo passo lógico para avançar com total segurança é a **validação em dispositivo** (executando o app no celular via cabo USB ou no emulador Android no Linux) para conferir a experiência visual e a leitura com a câmera real antes de submeter o PR para a branch `main`.
