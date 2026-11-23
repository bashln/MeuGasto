# Auditoria LGPD — MeuGasto

**Data:** 2026-11-23
**Versão auditada:** v0.5.8.0 (commit `f1159d0`)
**Escopo:** app Android (`mobile/`), schema e migrations Supabase (`supabase/`), documentação de segurança/privacidade.
**Método:** leitura estática do código, migrations, manifesto e documentação. Nenhum teste dinâmico contra a instância Supabase de produção, nenhum acesso a dados reais.

Este documento segue os três eixos da revisão de uso ético e legal dos dados:

1. **Ético** — consentimento e transparência.
2. **Legal** — LGPD e limites no uso de dados pessoais.
3. **Tecnológico** — criptografia e armazenamento seguro.

---

## 1. Sumário executivo

O app tem uma base técnica de privacidade acima da média para um projeto desse porte: RLS por usuário, analytics sem identificador com k-anonymity, permissões Android mínimas, tokens em `EncryptedSharedPreferences`, chave NFC-e convertida em hash, nenhum SDK de anúncios ou analytics de terceiros e nenhum log de dados de compra no código.

O que falta é a camada de **conformidade formal e de direitos do titular**. Hoje o app:

- não publica política de privacidade nem identifica controlador e encarregado;
- não permite excluir a conta nem exportar os dados;
- usa compras para analytics agregado sem informar isso no app e sem opt-in;
- não define prazo de retenção nem eliminação;
- guarda e-mail e nome em preferências não criptografadas;
- mantém a chave fiscal de 44 dígitos em texto puro no banco local quando a compra entra na fila da nuvem.

**Conclusão:** o app não está em conformidade plena com a LGPD. A arquitetura ajuda, mas os arts. 9º, 18, 41 e 46 não estão atendidos. Os itens P0 abaixo são pré-requisito para uso em produção com usuários reais no Brasil.

---

## 2. Achados priorizados

Legenda de confiança:

- **Confirmado** — verificado no código/configuração.
- **Risco com evidência** — há sinal concreto, mas falta validar em produção.
- **Hipótese não verificada** — inferência, não tratada como fato.

### P0 — bloqueadores de conformidade

#### P0-1. Não existe política de privacidade, controlador nem encarregado (art. 9º, 41)

**Confirmado.** Não há `PRIVACY.md`, tela ou URL de política no repositório. O único texto ao usuário é um parágrafo em [SettingsScreen.kt:265-270](mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/settings/SettingsScreen.kt) e dois parágrafos no onboarding. Não há nome/razão social do controlador, endereço, e-mail de contato, encarregado (DPO) nem canal para requisições de titular. `SECURITY.md` só cobre reporte de vulnerabilidade.

**Impacto:** o titular não sabe quem trata os dados, para quê, por quanto tempo, com quem compartilha nem como exercer direitos. Viola o dever de informação (art. 9º) e a indicação do encarregado (art. 41).

**Correção:** publicar política de privacidade versionada, acessível em Ajustes e no onboarding, com: controlador, encarregado + e-mail, bases legais por finalidade, categorias de dados, retenção, subprocessadores (Supabase, GitHub Releases), transferência internacional, direitos e como exercê-los.

#### P0-2. Direitos do titular sem mecanismo no produto (art. 18, II, III, V, VI)

**Confirmado.**

- **Exclusão de conta:** não existe. `SupabaseAuthRepository` expõe `signIn`, `signUp`, `signOut`, `changePassword`, `refreshSession` ([SupabaseAuthRepository.kt:42-82](mobile/app/src/main/kotlin/com/prati/meugasto/data/remote/supabase/SupabaseAuthRepository.kt)). A API só chama `signup`, `token` e `PUT /auth/v1/user` ([SupabaseApi.kt:117-160](mobile/app/src/main/kotlin/com/prati/meugasto/data/remote/supabase/SupabaseApi.kt)). "Desconectar" apaga a sessão e o cache local de compras da nuvem, mas mantém tudo no servidor.
- **Portabilidade/exportação:** nenhuma função de exportar compras, itens ou listas.
- **Correção:** o e-mail é somente leitura ([SettingsScreen.kt:220](mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/settings/SettingsScreen.kt)); o nome de exibição é salvo **só localmente** ([ProfileScreen.kt:245](mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/profile/ProfileScreen.kt)) e o `user_metadata` do Supabase continua com o valor antigo.

**Impacto:** art. 18 não é atendido por nenhuma via. Não há sequer canal manual documentado para pedidos.

**Correção:** (a) exclusão de conta com remoção em cascata no Supabase (`profiles` já tem `ON DELETE CASCADE`, mas compras/itens precisam de política explícita e confirmação); (b) exportação JSON/CSV local e da nuvem; (c) edição de nome/e-mail propagada ao backend; (d) e-mail de privacidade para pedidos manuais.

#### P0-3. Analytics de compras sem base legal explícita, sem transparência e sem opt-out (art. 7º, 9º, 12, 16)

**Confirmado no código; classificação jurídica depende de avaliação.**

O `run_analytics_aggregation` agrega **todas** as compras da nuvem por item, mercado, cidade e dia ([20261108170000_explicit_item_price_basis.sql:355-480](supabase/migrations/20261108170000_explicit_item_price_basis.sql)). As tabelas finais não têm `user_id`, mas o job lê `p.user_id` para `COUNT(DISTINCT ...)`. Não há opt-in, nem aviso no app, nem opção de não contribuir; o texto de privacidade no app não menciona analytics. O README descreve k-anonymity ([README.md:34](README.md)), mas essa informação não chega ao titular.

**Impacto:** usar dados de consumo para finalidade secundária (inteligência coletiva de preços) exige base legal própria e informação clara. A anonimização do art. 12 não é automática: exige processos e salvaguardas que impeçam reversão. k=5 fixo pode ser insuficiente em cidades pequenas, itens raros ou mercados com poucos contribuintes — combinação já reconhecida em [docs/architecture/privacy.md](docs/architecture/privacy.md).

**Correção:** decidir e documentar a base legal; informar no app antes do primeiro upload; oferecer opt-out real (excluir contribuição e impedir reagregação); tornar k dinâmico por cardinalidade (cidade/mercado/item) ou suprimir buckets pequenos; registrar a decisão em RIPD.

#### P0-4. Retenção e eliminação indefinidas (art. 15, 16)

**Confirmado.** Não há job, coluna ou política de expiração para `purchases`, `items`, `drafts`, `profiles` ou `analytics_*`. Rascunhos não expiram. Excluir uma compra no app remove a linha local e, se sincronizada, a remota; mas encerrar a conta não remove nada. Analytics agregados ficam para sempre.

**Correção:** definir prazos por categoria (ex.: rascunhos 30 dias; compras enquanto a conta existir; analytics agregados com revisão periódica), implementar expiração e documentar na política.

### P1 — alto risco

#### P1-1. E-mail e nome em `SharedPreferences` sem criptografia (art. 46)

**Confirmado.** Tokens vão para `EncryptedSharedPreferences`, mas `saveUserEmail` e `saveUserName` gravam em `meugasto_settings`, um `SharedPreferences` comum ([UserPreferences.kt:40,124-132](mobile/app/src/main/kotlin/com/prati/meugasto/data/local/preferences/UserPreferences.kt)). O identificador da conta (`user_id`) também.

**Impacto:** PII em texto claro no sandbox do app. Sem root ou backup o acesso é difícil, mas o controle é mais fraco que o adotado para tokens e não resiste a extração física/forense.

**Correção:** mover e-mail, nome e `user_id` para o armazenamento criptografado; migrar valores existentes e apagar os antigos.

#### P1-2. Chave NFC-e completa em texto puro no banco local (art. 46)

**Confirmado.** No modo nuvem, a compra é salva com `accessKey` completo ([Repositories.kt:139-142](mobile/app/src/main/kotlin/com/prati/meugasto/data/repository/Repositories.kt)) e o upload usa esse valor ([CloudPurchaseUploader.kt:108](mobile/app/src/main/kotlin/com/prati/meugasto/data/remote/supabase/CloudPurchaseUploader.kt)). Depois do upload, `reconcileUploadedPurchase` grava o `remoteId` mas **não limpa** `accessKey`. O backfill que limpava a chave roda apenas na migração 6→7 ([AppDatabase.kt:87-126](mobile/app/src/main/kotlin/com/prati/meugasto/data/local/database/AppDatabase.kt)). No modo local a chave não é gravada.

**Impacto:** a chave de 44 dígitos é identificador fiscal que permite consultar a nota no portal SEFAZ. Fica em SQLite sem criptografia, indefinidamente, apenas no modo nuvem.

**Correção:** apagar `accessKey` logo após o upload bem-sucedido, mantendo só o hash; se o reparo de recibo precisar da chave, pedir nova leitura do QR (o fluxo `repairReceipt` já aceita a chave vinda do recibo).

#### P1-3. Hash da chave fiscal cai para SHA-256 sem segredo

**Confirmado no código; configuração de produção não verificada.** A RPC usa HMAC quando `app.hmac_secret` está definido; caso contrário usa SHA-256 puro ([baseline:210-225](supabase/migrations/20260617172638_remote_baseline.sql)). Não há migration, script ou documentação neste repositório definindo `app.hmac_secret`.

**Impacto:** se o segredo não estiver configurado no projeto remoto, o hash é reversível por força bruta direcionada (CNPJ e data conhecidos reduzem o espaço de busca). Qualquer dump do banco permitiria reconstruir a chave e consultar a nota.

**Correção:** verificar `current_setting('app.hmac_secret')` na instância real; se ausente, configurar e regravar os hashes; falhar fechado (recusar gravar) em vez de cair para SHA-256; documentar a rotação.

### P2 — médio risco

#### P2-1. Transferência internacional não documentada (art. 33)

**Hipótese não verificada.** O app usa Supabase, mas o repositório não informa região do projeto nem cláusulas de transferência. Se o projeto estiver fora do Brasil, há transferência internacional sem informação ao titular.

**Ação:** confirmar a região do projeto; se fora do Brasil, documentar base legal do art. 33 e informar na política.

#### P2-2. Sem registro de operações nem RIPD (art. 37, 38)

**Confirmado.** A documentação interna ([docs/architecture/privacy.md](docs/architecture/privacy.md), [docs/adr/0001-admin-blind-e2ee.md](docs/adr/0001-admin-blind-e2ee.md)) é boa, mas não substitui registro das operações de tratamento nem avaliação de impacto. O tratamento envolve dados financeiros e perfilhamento de consumo — cenário típico de RIPD.

**Ação:** produzir RIPD cobrindo analytics, k-anonymity, base legal e riscos de reidentificação; manter registro de operações atualizado.

#### P2-3. Onboarding não registra ciência nem consentimento (art. 8º, 9º)

**Confirmado.** `completeOnboarding` grava apenas `onboarding_completed = true` ([OnboardingScreen.kt:50-52](mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/onboarding/OnboardingScreen.kt)); não há aceite de termos, versão aceita nem data. O texto do onboarding é descritivo, não informativo de tratamento.

**Ação:** se a base legal for consentimento para alguma finalidade, registrar aceite com versão e timestamp; se não for, garantir informação mínima e link para a política.

#### P2-4. Sem plano de resposta a incidentes com comunicação à ANPD e ao titular (art. 48)

**Confirmado.** `SECURITY.md` orienta reporte privado de vulnerabilidade, mas não há procedimento, prazo, responsáveis nem modelo de comunicação de incidente.

**Ação:** documentar runbook de incidente com prazo de avaliação e comunicação.

#### P2-5. Sem tratamento específico de dados de menores (art. 14)

**Confirmado.** Não há declaração de idade mínima nem fluxo de consentimento parental. Para app financeiro, o risco é baixo, mas a ausência deve ao menos ser decidida e documentada.

#### P2-6. Nome de exibição corrigido só no aparelho

**Confirmado.** Ver P0-2. Além do direito de correção, gera divergência entre o que o usuário vê e o que o backend mantém.

#### P2-7. Documentação divergente sobre Sentry

**Confirmado.** `CHANGELOG.md:31` cita integração Sentry e o follow-up lista testes de sanitização, mas não há dependência, código ou manifesto Sentry no app atual. A documentação sugere um canal de telemetria que não existe — ou, se for reintroduzido sem os testes prometidos, vira risco de vazamento.

**Ação:** remover as referências obsoletas ou implementar o canal com sanitização e testes.

### P3 — baixo risco / endurecimento

- **Banco Room sem criptografia.** Dados financeiros dependem da criptografia de disco do Android e do sandbox. Recomendado SQLCipher ou campo criptografado para itens/valores, se o modelo de ameaça incluir extração do aparelho.
- **Sem `FLAG_SECURE`.** Capturas de tela de telas com gastos não são bloqueadas. Decisão de UX, não obrigação legal.
- **`allowBackup="false"` presente, mas sem `dataExtractionRules`.** Em Android 12+, declarar regras explícitas de backup/transferência reduz ambiguidade. ([AndroidManifest.xml:21](mobile/app/src/main/AndroidManifest.xml))
- **Release sem minificação** (`isMinifyEnabled = false`), sem certificate pinning e sem detecção de ambiente comprometido. Endurecimento, não requisito LGPD.
- **`REQUEST_INSTALL_PACKAGES`** é justificado pelo atualizador in-app; manter monitorado.
- **WebDAV** guarda credenciais em armazenamento seguro, mas envia compras a um servidor escolhido pelo usuário; hoje não há UI que exponha a configuração. Se for reativado, precisa de aviso explícito (o usuário vira controlador daquele armazenamento).

---

## 3. O que já está adequado (verificado)

- **RLS por usuário** em `purchases`, `items`, `drafts`, `profiles`, listas, comparações e mercados; leitura/escrita restritas a `auth.uid()`.
- **Sobrecarga legada da RPC com `p_user_id` removida** e privilégios reconciliados ([20260811120000](supabase/migrations/20260811120000_revoke_legacy_purchase_rpc_and_constraints.sql), [20260810120000](supabase/migrations/20260810120000_security_privilege_reconciliation.sql)).
- **Analytics sem identificador:** sem `user_id`, `purchase_id` ou e-mail; leitura revogada para `PUBLIC`/`anon`/`authenticated`; `CHECK contributor_count >= 5` e RLS.
- **Constraint contra chave fiscal em texto puro no servidor** (`purchases_no_plaintext_access_key_check`).
- **Tokens de sessão** em `EncryptedSharedPreferences` com chave no Android Keystore, com fallback para memória volátil em vez de disco aberto.
- **Troca de senha exige reautenticação** com a senha atual.
- **Manifesto mínimo:** câmera, internet, estado de rede e instalação de pacote; `RECORD_AUDIO` bloqueado; `allowBackup=false`; FileProvider restrito a `cacheDir/updates/`.
- **Atualizador in-app** restrito a HTTPS e hosts oficiais do GitHub, com validação de ZIP.
- **Nenhum log de dados de compra** (`Log.*`, `println`, Timber, Crashlytics, Firebase, Sentry) no código de produção do app.
- **Nenhum SDK de anúncios, attribution ou analytics de terceiros.** ML Kit é usado para leitura de código de barras no dispositivo.
- **Consultas NFC-e** restritas a portais estaduais por HTTPS, com validação de redirecionamento e limite de payload.

---

## 4. Matriz LGPD → situação

| Artigo | Tema | Situação |
| --- | --- | --- |
| 6º | Finalidade, necessidade, transparência | Parcial — minimização boa; transparência ausente |
| 7º | Base legal | Ausente/indocumentada, sobretudo para analytics |
| 8º | Consentimento | Não aplicável hoje; sem registro de aceite |
| 9º | Informação ao titular | **Não atendido** |
| 12 | Anonimização | Parcial — k=5 fixo, sem avaliação formal |
| 14 | Menores | Não tratado |
| 15/16 | Término e eliminação | **Não atendido** |
| 18 | Direitos do titular | **Não atendido** (II, III, V, VI) |
| 33 | Transferência internacional | Não documentada |
| 37/38 | Registros e RIPD | Ausentes |
| 41 | Encarregado | **Não atendido** |
| 46 | Segurança | Parcial — PII e chave fiscal em claro no dispositivo |
| 48 | Comunicação de incidente | Ausente |

---

## 5. Plano de remediação sugerido

**Antes de qualquer release com usuários reais (P0)**

1. Publicar política de privacidade + identificação do controlador e encarregado, com link em Ajustes e onboarding.
2. Implementar exclusão de conta (local + Supabase) e exportação de dados.
3. Decidir e documentar a base legal do analytics; informar no app; criar opt-out.
4. Definir e implementar retenção mínima por categoria.

**Próximo ciclo (P1)**

5. Migrar e-mail, nome e `user_id` para armazenamento criptografado.
6. Limpar `accessKey` após upload e reavaliar necessidade do campo local.
7. Verificar/configurar `app.hmac_secret`; remover o fallback SHA-256.
8. Propagar correção de nome/e-mail ao backend.

**Governança contínua (P2/P3)**

9. RIPD + registro de operações.
10. Runbook de incidente (art. 48).
11. Confirmar região do Supabase e documentar transferência internacional.
12. Limpar documentação obsoleta de Sentry.
13. Endurecer armazenamento local (SQLCipher/`dataExtractionRules`), se o modelo de ameaça justificar.

---

## 6. Limitações desta auditoria

- Não houve acesso à instância Supabase de produção: não foi possível confirmar `app.hmac_secret`, região do projeto, dados existentes, políticas efetivamente aplicadas nem se o job de analytics está agendado.
- Não houve teste dinâmico do APK assinado nem análise do binário publicado.
- A qualificação jurídica (base legal, anonimização, transferência internacional) é análise técnica de conformidade, não parecer jurídico.
- Itens marcados como hipótese não foram tratados como achados confirmados.
