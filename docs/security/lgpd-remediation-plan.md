# Plano de remediação LGPD — MeuGasto

**Objetivo:** fechar os achados de [lgpd-audit-2026-11-23.md](lgpd-audit-2026-11-23.md) em PRs sequenciados P0 → P1 → P2.
**Modo:** plano apenas. Nenhuma implementação, nenhuma migration aplicada, nenhum dado de produção tocado.
**Base:** auditoria de 2026-11-23 (commit `f1159d0`), [ADR 0001](../adr/0001-admin-blind-e2ee.md), [arquitetura de privacidade](../architecture/privacy.md), [SECURITY.md](../../SECURITY.md).

## O que muda

1. **Governança e transparência:** política de privacidade pública e offline, controlador e encarregado identificados, canal de direitos, RIPD, runbook de incidente, retenção documentada.
2. **Direitos do titular:** excluir conta e dados do aparelho; exportar todos os dados; corrigir nome e e-mail no backend.
3. **Analytics:** transparência no app, opt-out real com recomputação, k mínimo de 10, filtro explícito na agregação.
4. **Segurança local:** PII em armazenamento criptografado; chave NFC-e apagada após upload; HMAC fail-closed com versão de hash.
5. **Retenção:** expiração de rascunhos, analytics e auditoria.

Nenhuma promessa de "admin-blind" entra na interface antes do ADR 0001 sair de "proposta".

## Principio de fatiamento

Cada PR é uma unidade verificável isolada (principle-sequence-verifiable-units): parte de um estado verde, faz uma mudança, roda a verificação e só então o próximo entra. Decisões repetidas ficam em um único lugar — a política, a retenção e o k vivem em um único arquivo/constante por vez (principle-laziness-protocol). Por isso não há Edge Function nem SDK novo: exclusão usa RPC `SECURITY DEFINER`; exportação usa SAF; política é um arquivo markdown com cópia verificada por CI.

## Decisões que dependem de você (pré-requisitos)

| ID | Decisão | Dono | Proposta padrão | Bloqueia |
| --- | --- | --- | --- | --- |
| D1 | Identidade do controlador (razão social/CPF, endereço, contato) | você | — | PR-01 |
| D2 | Encarregado (DPO): nome e e-mail | você | — | PR-01 |
| D3 | Base legal por finalidade | você + jurídico | Contrato (art. 7º V) para conta/sincronização; consentimento explícito opt-in (art. 7º I) para analytics; local-first sem conta dispensa tratamento pelo controlador | PR-01, PR-02, PR-05 |
| D4 | Prazos de retenção | você | Rascunhos 30 dias; compras enquanto a conta existir; analytics agregados 24 meses; auditoria de acesso 12 meses; exportações temporárias | PR-06 |
| D5 | Região real do projeto Supabase | você/ops | — | PR-11 |
| D6 | Aprovar k mínimo = 10 (hoje 5) | você | k=10 em todas as tabelas analíticas | PR-05 |
| D7 | Exclusão via RPC `SECURITY DEFINER` (sem Edge Function) | técnico | RPC, com teste em staging; fallback Edge Function só se staging falhar | PR-03 |
| D8 | Verificação "live" de UI sem emulador nesta VPS | você | Checklist manual em APK + testes HTTP de staging; sem dependência nova (Robolectric fica fora) | todos os PRs de UI |

Se D3 for "legítimo interesse" em vez de consentimento, o PR-05 troca opt-in por opt-out com RIPD aprovado; o resto do plano não muda. Se D3 não estiver decidido, **não ligue a agregação de analytics em produção** (ver Ações imediatas).

## Grafo de dependências e ordem de entrega

```
Independentes do trunk: PR-03, PR-04, PR-07, PR-08, PR-09, PR-10, PR-12
PR-01 ──► PR-02 ──► PR-05
PR-01 ──► PR-11          (PR-11 também espera D1–D5)
D4 ──► PR-06
PR-08 e PR-09 não se tocam (cliente vs. servidor), mas landam em sequência
```

| Ordem | PR | Prioridade | Depende de | Gate de review |
| --- | --- | --- | --- | --- |
| 1 | PR-01 política e canal | P0 | D1–D3 | jurídico |
| 2 | PR-02 política e ciência no app | P0 | PR-01, D3, D8 | sim (UI) |
| 3 | PR-03 excluir conta e dados | P0 | D7, staging | sim (destrutivo) |
| 4 | PR-04 exportar dados | P0 | D8 | sim (UI) |
| 5 | PR-05 analytics: opt-out, k=10 | P0 | PR-02, D3, D6 | sim (privacidade) |
| 6 | PR-06 retenção | P0 | D4 | sim |
| 7 | PR-07 PII criptografada | P1 | — | sim |
| 8 | PR-08 limpar chave NFC-e | P1 | — | sim |
| 9 | PR-09 HMAC fail-closed | P1 | segredo operacional | sim |
| 10 | PR-10 corrigir nome/e-mail | P1 | D8 | sim (UI) |
| 11 | PR-11 governança interna | P2 | PR-01, D1–D5 | jurídico |
| 12 | PR-12 endurecimento e docs | P2 | D9 | não |

## Padrão de verificação por PR

- **Unit:** `cd mobile && ./gradlew test` + `bash scripts/privacy-check.sh` verdes.
- **SQL:** banco descartável no padrão de `supabase/tests/README.md` (`createdb` + `psql -v ON_ERROR_STOP=1`). Migrations nunca testadas contra produção.
- **Live:** `scripts/supabase-http-security-test.mjs` em staging para tudo que é servidor; checklist manual no APK para o que é UI (D8). Sem emulador nesta VPS.
- **Perf:** métrica nomeada, sonda, base medida antes e número que reprova. Onde não há caminho de runtime novo, o box diz `N/A` com justificativa.
- **Deploy:** migrations entram no repositório; aplicação em staging primeiro; produção é passo do operador, com backup e janela definidos. `main` protegida, PRs via `dev`.

---

## PR-01 — Política de privacidade e canal do titular

**Muda:** publica a política v1.0 com controlador, encarregado, finalidades, bases legais, categorias de dados, subprocessadores, transferência internacional, retenção (referência a D4), direitos e canal; cria o canal de pedidos.

**Arquivos:** `docs/privacy/privacy-policy.md` (novo), `docs/security/privacy-rights.md` (novo, procedimento interno de atendimento), `scripts/privacy-check.sh`, `docs/README.md`, `SECURITY.md`.

**Depende de:** D1, D2, D3. D4 pode entrar como "a definir" na v1.0, mas o ideal é fechar antes.

**Resultado visível:** qualquer pessoa encontra a política em URL pública estável (blob na tag da release) e um e-mail para exercer direitos.

**Verificação**

- [ ] Unit/documento: `privacy-check.sh` falha se faltar controlador, encarregado, canal, seção de direitos ou se a política não estiver indexada.
- [ ] Live: todos os links da política resolvem; URL pública abre sem login.
- [ ] Perf: N/A — sem caminho de runtime.
- [ ] Revisão jurídica registrada no PR.

## PR-02 — Política e registro de ciência no app

**Muda:** tela offline da política, link em Ajustes e no onboarding, e registro local de versão + data de ciência/aceite conforme D3. A cópia embarcada é gerada de `docs/privacy/privacy-policy.md`; CI reprova divergência.

**Arquivos:** `mobile/app/src/main/res/raw/privacy_policy.md`, `scripts/sync-privacy-policy.sh` (novo), `scripts/privacy-check.sh`, `ui/screens/privacy/PrivacyPolicyScreen.kt` (novo), `ui/navigation/Navigation.kt`, `ui/screens/settings/SettingsScreen.kt`, `ui/screens/onboarding/OnboardingScreen.kt`, `data/local/preferences/UserPreferences.kt`, `app/src/test/.../OnboardingFlowTest.kt`, `NavigationStructureTest.kt`, `PrivacyPolicyVersionTest.kt` (novo).

**Depende de:** PR-01, D3, D8.

**Resultado visível:** usuário lê a política sem rede; vê a versão aceita; se a base for consentimento, o onboarding só conclui após marcar ciência.

**Verificação**

- [ ] Unit: teste garante que a versão exibida é a versão do arquivo embarcado; onboarding não conclui sem aceite quando D3 = consentimento; navegação alcança a tela.
- [ ] Live: APK em aparelho — abrir Ajustes → Política, voltar, onboarding em instalação limpa; registrar print no PR.
- [ ] Perf: abertura da política < 300 ms; impacto no cold start < 50 ms (medir antes/depois).
- [ ] Review de UI.

## PR-03 — Excluir conta e apagar dados do aparelho

**Muda:** duas ações explícitas na área de perigo: "Excluir conta na nuvem" (RPC `delete_own_account()`, cascata em `auth.users`) e "Apagar dados deste aparelho" (banco local + preferências). A exclusão de conta também recomputa os buckets analíticos afetados.

**Arquivos:** `supabase/migrations/20261123120000_account_self_deletion.sql` (novo), `supabase/tests/account_deletion_setup.sql` e `_assertions.sql` (novos), `data/remote/supabase/SupabaseApi.kt`, `SupabaseAuthRepository.kt`, `ui/screens/settings/SettingsScreen.kt`, `ui/screens/settings/DeleteAccountDialog.kt` (novo), `data/local/database/AppDatabase.kt`/`Daos.kt`, `data/local/preferences/UserPreferences.kt`, `scripts/supabase-http-security-test.mjs`, `scripts/privacy-check.sh`, `SupabaseApiTest.kt`, `SupabaseAuthRepositoryTest.kt`, `DeleteAccountFlowTest.kt` (novo).

**Mecanismo (D7):** função `SECURITY DEFINER` com `search_path` fixo, `REVOKE` de `PUBLIC`/`anon`, `GRANT` só para `authenticated`; apaga `auth.users WHERE id = auth.uid()`; as FKs já têm `ON DELETE CASCADE` para `purchases`, `items`, `profiles`, `drafts`, `shopping_lists` e comparações. Confirmação por texto digitado; sessão encerrada e cache limpo.

**Depende de:** ambiente staging (D7).

**Resultado visível:** usuário exclui a conta sem abrir ticket; ao voltar, login falha; dados locais somem quando ele escolhe essa opção.

**Verificação**

- [ ] Unit: cliente chama a RPC certa, limpa sessão e cache; teste de UI do diálogo (texto de confirmação).
- [ ] SQL: em banco descartável, usuário com compras/listas/rascunhos é apagado e as linhas filhas somem; `anon` recebe negação; função não aceita id de terceiro.
- [ ] Live: staging cria usuário A descartável, exclui, confirma 401 no token antigo e zero linhas; usuário B intacto.
- [ ] Perf: exclusão < 5 s com 10 mil compras; medir em staging, base antes da mudança.
- [ ] Review de PR obrigatório (destrutivo).

## PR-04 — Exportar dados do titular

**Muda:** botão "Exportar meus dados" gera um JSON versionado com perfil, mercados, compras, itens, listas e rascunhos, via SAF (`ACTION_CREATE_DOCUMENT`); sem permissão de armazenamento, sem token nem senha no arquivo.

**Arquivos:** `domain/export/DataExport.kt` (novo), `data/repository/Repositories.kt` (consulta), `ui/screens/settings/SettingsScreen.kt`, `DataExportTest.kt` (novo), `privacy-check.sh` (garante que o exporter não inclui `accessKey`, tokens ou senha).

**Depende de:** D8.

**Resultado visível:** usuário salva um arquivo legível com tudo o que o app guarda sobre ele.

**Verificação**

- [ ] Unit: JSON contém todas as entidades, respeita o schema versionado e não contém campos proibidos.
- [ ] Live: exportar em aparelho, abrir o arquivo, conferir contagens contra a tela; CSV fica fora do escopo desta versão.
- [ ] Perf: 10 mil compras exportadas < 2 s e arquivo < 20 MB; medir com fixture sintética.

## PR-05 — Analytics: transparência, opt-out e k=10

**Muda:** coluna `profiles.analytics_opt_out`, RPC `purge_my_analytics_contributions()`, filtro `WHERE NOT profiles.analytics_opt_out` na agregação, k mínimo de 10 nas três tabelas e nas policies, toggle em Ajustes com texto explicando analytics, e aviso antes do primeiro upload no modo nuvem.

**Arquivos:** `supabase/migrations/20261123130000_analytics_consent_and_k10.sql` (novo), `supabase/tests/analytics_opt_out_setup.sql` e `_assertions.sql` (novos), `scripts/backfill-analytics.sql` (novo), `scripts/privacy-check.sh`, `scripts/supabase-http-security-test.mjs`, `data/remote/supabase/SupabaseApi.kt`, `data/remote/supabase/AnalyticsPreferencesRepository.kt` (novo), `ui/screens/settings/SettingsScreen.kt`, `ui/screens/privacy/PrivacyPolicyScreen.kt`, testes JVM e SQL correspondentes.

**Depende de:** PR-02 (texto), D3, D6.

**Resultado visível:** usuário vê que existe analytics, liga/desliga, e o agregado deixa de contar sua contribuição depois da recomputação.

**Verificação**

- [ ] Unit SQL: 11 contribuintes geram bucket; 9 não geram; usuário com opt-out sai do bucket após `purge`; policy de leitura exige `contributor_count >= 10`.
- [ ] Unit app: toggle chama a RPC, reflete estado e sobrevive a reinício.
- [ ] Live: staging com dois usuários — A desliga, B permanece; rodar `run_analytics_aggregation` e conferir `contributor_count`; conferir que `anon`/`authenticated` não leem `analytics_*`.
- [ ] Perf: recomputação de 24 meses de um usuário < 5 s em staging; backfill completo medido e registrado antes de produção.
- [ ] Review de privacidade obrigatório.

## PR-06 — Retenção e eliminação programada

**Muda:** expiração de rascunhos no aparelho, retenção de analytics agregados, expiração de auditoria de acesso e agendamento diário; prazos vêm de uma única fonte de verdade.

**Arquivos:** `supabase/migrations/20261123140000_retention_jobs.sql` (novo), `supabase/tests/retention_assertions.sql` (novo), `data/local/database/Daos.kt`, `data/repository/Repositories.kt` (limpeza na inicialização), `AppDatabase.kt` se houver migração, `RetentionTest.kt` (novo), `privacy-check.sh`.

**Depende de:** D4. Se `pg_cron` não estiver habilitado no projeto, o agendamento vira passo operacional documentado, sem dependência nova no app.

**Resultado visível:** rascunhos velhos somem; analytics antigos não ficam para sempre; a política publicada bate com o código.

**Verificação**

- [ ] Unit: DAO apaga rascunho com data anterior ao limite e preserva o recente.
- [ ] Unit SQL: função de retenção apaga só as linhas fora do prazo e é idempotente.
- [ ] Live: rodar a função em staging com fixtures datadas; conferir contagens antes/depois.
- [ ] Perf: N/A — volume pequeno; registrar tempo da função em staging.

## PR-07 — PII em armazenamento criptografado

**Muda:** e-mail, nome e `user_id` migram para `EncryptedSharedPreferences`; valores antigos são lidos, copiados e apagados uma vez.

**Arquivos:** `data/local/preferences/UserPreferences.kt`, `UserPreferencesMigrationTest.kt` (novo), `InMemorySharedPreferencesTest.kt`, `SupabaseAuthRepositoryTest.kt`, `privacy-check.sh` (proíbe PII em `plainPrefs`), teste instrumentado de keystore.

**Resultado visível:** nenhum dado pessoal em claro no armazenamento do app; sessão continua após atualização.

**Verificação**

- [ ] Unit: migração move os três campos, é idempotente e não perde sessão; guardrail falha se alguém voltar a gravar e-mail no `plainPrefs`.
- [ ] Live: instalar v0.5.8, fazer login, atualizar para o build do PR, confirmar sessão e e-mail.
- [ ] Perf: migração < 50 ms no primeiro start; medir antes/depois.

## PR-08 — Apagar a chave NFC-e após upload

**Muda:** depois de reconciliar o `remoteId`, o uploader zera `accessKey`; migração 7→8 limpa chaves de compras já sincronizadas; o reparo de recibo passa a exigir nova leitura do QR (fluxo já existente).

**Arquivos:** `data/repository/Repositories.kt`, `data/remote/supabase/CloudPurchaseUploader.kt`, `data/local/database/Daos.kt`, `AppDatabase.kt` + `mobile/app/schemas/8.json`, `CloudPurchaseUploaderTest.kt`, `AppDatabaseMigrationTest.kt`, `AppDatabaseMigrationInstrumentedTest.kt`, `privacy-check.sh`.

**Resultado visível:** no modo nuvem, a chave fiscal não fica guardada depois da sincronização.

**Verificação**

- [ ] Unit: após upload, `accessKey` é nulo e `accessKeyHash` permanece; repetir upload não recria a chave; deduplicação continua igual.
- [ ] Unit: migração 7→8 limpa somente linhas com `remoteId`.
- [ ] Live: APK em modo nuvem, escanear, sincronizar, inspecionar o banco via `adb`/teste instrumentado — coluna nula.
- [ ] Perf: N/A — mesmo caminho de upload, sem consulta nova.

## PR-09 — HMAC fail-closed e versão do hash

**Muda:** nova coluna `access_key_hash_version` (1 = SHA-256 legado, 2 = HMAC), RPC recusa gravar quando o segredo não está configurado, leitura do segredo via Vault, e dedupe só compara versões iguais. Hashes antigos não são convertíveis sem a chave; ficam marcados e podem ser atualizados quando o usuário reescaneia.

**Arquivos:** `supabase/migrations/20261123150000_hmac_fail_closed.sql` (novo), `supabase/tests/hmac_setup.sql` e `_assertions.sql` (novos), `docs/security/hmac-operations.md` (novo), `privacy-check.sh`, `scripts/supabase-http-security-test.mjs`.

**Depende de:** segredo configurado no projeto (passo operacional). Sem ele, o deploy do PR deixa o upload de compras falhando de forma explícita — comportamento desejado.

**Resultado visível:** nenhuma compra nova grava hash fraco; o erro é claro se o segredo faltar.

**Verificação**

- [ ] Unit SQL: com segredo, hash é HMAC v2; sem segredo, a RPC levanta exceção; dedupe não mistura v1 com v2; constraint de chave em claro continua valendo.
- [ ] Live: staging com segredo de teste; contar hashes v1 existentes e registrar como risco residual.
- [ ] Perf: N/A — mesma ordem de custo do HMAC.

## PR-10 — Correção de nome e e-mail no backend

**Muda:** "Salvar" no perfil atualiza `user_metadata` e `profiles.name`; troca de e-mail usa o fluxo de confirmação do GoTrue e explica o passo; nada fica só no aparelho.

**Arquivos:** `data/remote/supabase/SupabaseApi.kt`, `SupabaseAuthRepository.kt`, `ui/screens/profile/ProfileScreen.kt`, `SupabaseApiTest.kt`, `SupabaseAuthRepositoryTest.kt`, `ProfileUpdateTest.kt` (novo), `scripts/supabase-http-security-test.mjs`.

**Resultado visível:** nome corrigido aparece após novo login; e-mail novo só vale após confirmação.

**Verificação**

- [ ] Unit: payload correto, erro de confirmação tratado, estado local só muda após sucesso.
- [ ] Live: staging — alterar nome, deslogar, logar, conferir; solicitar troca de e-mail e conferir resposta do GoTrue.
- [ ] Perf: N/A.

## PR-11 — Governança interna

**Muda:** RIPD (analytics, k, reidentificação), registro das operações (ROPA), runbook de incidente com prazo e comunicação à ANPD/titular, decisão documentada sobre menores, e região/transferência internacional.

**Arquivos:** `docs/security/ripd.md` (novo), `docs/security/ropa.md` (novo), `docs/security/incident-response.md` (novo), `docs/privacy/privacy-policy.md` (seção de transferência), `docs/security/lgpd-audit-2026-11-23.md` (status), `scripts/privacy-check.sh` (arquivos e seções obrigatórias).

**Depende de:** PR-01, D1–D5.

**Verificação**

- [ ] Unit: guardrail exige os três documentos e as seções mínimas.
- [ ] Live: revisão jurídica registrada; links internos resolvem.
- [ ] Perf: N/A.

## PR-12 — Endurecimento e limpeza de documentação

**Muda:** regras explícitas de backup/transferência (`dataExtractionRules`), remoção das referências obsoletas a Sentry, e decisão registrada sobre `FLAG_SECURE` (D9). SQLCipher e minificação ficam fora, como itens avaliados e adiados.

**Arquivos:** `mobile/app/src/main/AndroidManifest.xml`, `mobile/app/src/main/res/xml/data_extraction_rules.xml` (novo), `CHANGELOG.md`, `docs/security/supabase-remote-security-follow-up.md`, `scripts/privacy-check.sh`.

**Verificação**

- [ ] Unit: guardrail exige `dataExtractionRules` e proíbe citação de Sentry sem dependência.
- [ ] Live: `./gradlew assembleDebug assembleDebugAndroidTest` verdes; manifesto processado sem permissão nova.
- [ ] Perf: N/A.

---

## Ações imediatas (fora de PR)

1. **Pausar a agregação de analytics** até D3: desabilitar o agendamento (`cron.unschedule('aggregate-analytics-daily')` ou equivalente) e não rodar `run_analytics_aggregation` manualmente. O job agrega dados de titulares sem base legal documentada.
2. **Verificar o segredo HMAC e a região** do projeto real: `current_setting('app.hmac_secret', true)` e painel do Supabase. Registrar o resultado no PR-09/PR-11.
3. **Backup e janela** antes de qualquer migration em produção; nenhuma migration deste plano apaga dados de usuário.
4. **Não usar `service_role` no app** em nenhum PR; a exclusão é por RPC com `auth.uid()`.
5. **Congelar promessa de marketing** "nem nós sabemos" até o ADR 0001 ser entregue; a comunicação atual deve dizer "RLS e acesso administrativo controlado".

## O que este plano não prova

- A exclusão em cascata no Supabase real só fica provada no PR-03 com staging. O teste SQL local cobre FKs e guardas, não o GoTrue.
- O comportamento de UI (diálogos, toasts, navegação) não roda em CI nesta VPS; fica no checklist manual (D8).
- A adequação jurídica da política, da base legal e do k=10 depende de revisão humana; o plano entrega o artefato, não o parecer.
- O estado de produção (segredo HMAC, região, hashes legados) não é observável do repositório.
- Não há verificação de performance em aparelho real; os números de perf são medidos em staging ou com fixture sintética.
