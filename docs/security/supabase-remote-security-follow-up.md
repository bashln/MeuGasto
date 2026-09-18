# Segurança Supabase Remota — Estado e Próximos Passos

**Status:** hardening remoto e reconciliação de privilégios aplicados e validados no banco em 10/08/2026.
**Escopo:** Supabase, app móvel Android, observabilidade, NFC-e e operação de releases.

Este documento registra o estado de segurança efetivamente verificado na instância Supabase remota e prioriza o trabalho restante. Não contém credenciais, URLs privadas, IDs de usuários ou dados de compras.

## Estado validado

As migrations SQL abaixo foram aplicadas na instância remota vinculada pelo Supabase CLI, nesta ordem:

1. `mobile/supabase_learned_reclassifications_migration_20260806.sql`
2. `mobile/supabase_privacy_migration.sql`
3. `mobile/supabase_security_hardening_migration.sql`
4. `mobile/supabase_security_remediation_20260806.sql`

A primeira migration foi criada para corrigir um drift: a tabela-base `learned_reclassifications` não existia no remoto, embora fosse usada pelo app e exigida pelas migrations de privacidade e hardening.

### Proteções confirmadas no banco remoto

- RLS ativa em `learned_reclassifications`, tabelas `analytics_*`, `sensitive_access_audit` e `private.authenticated_write_rate_limits`.
- Tabelas de analytics e auditoria não concedem leitura/escrita a `anon` ou `authenticated`.
- Funções RPC da aplicação não concedem execução a `anon`; as funções de uso do app são restritas a `authenticated`.
- Funções `SECURITY DEFINER` internas não são executáveis por papéis de cliente.
- `search_path` das RPCs e funções relevantes está fixado.
- Gatilhos de quotas e rate limits estão instalados nas tabelas protegidas.
- `service_role` não foi encontrado no código móvel rastreado.

### Testes executados

| Teste | Resultado | Observação |
| --- | --- | --- |
| `mobile/supabase_security_hardening_smoke_test.sql` | Aprovado | Executa em transação, valida grants de RPCs/helpers/analytics e sempre faz `ROLLBACK`; executado após a reconciliação em 10/08/2026. |
| `mobile/supabase_security_rls_integration_test.sql` | Aprovado | Cria fixtures efêmeras, alterna identidades A/B e termina com `ROLLBACK`. |
| Isolamento A → B | Aprovado | A não leu nem alterou perfil, compras, itens ou listas de B. |
| RPC cross-user | Aprovado | A RPC de compra rejeitou supermercado pertencente a B. |
| Rate limit real | Aprovado | O gatilho rejeitou a escrita 241 de uma lista. |
| Quota real | Aprovado | O gatilho rejeitou a lista 1.001. |
| Privilégios de analytics/auditoria | Aprovado | Papéis `anon` e `authenticated` sem acesso. |
| `bash scripts/secret-scan.sh` | Aprovado | Sem formatos conhecidos de segredos no Git ou arquivos rastreados. |

## Prioridade 0 — Consolidar e rastrear migrations remotas

### Problema

O histórico de migrations gerenciado pelo Supabase na instância remota não refletia as migrations SQL mantidas em `mobile/`. Aplicar SQL com `supabase db query --linked --file` altera o banco, mas não cria automaticamente um registro de migration versionada no diretório padrão `supabase/migrations/`.

Sem uma fonte de verdade de migrations, um novo ambiente pode voltar a nascer sem tabelas, policies, quotas ou rate limits essenciais.

### Próximas ações

- [x] Criar uma estrutura versionada de migrations do Supabase em `supabase/migrations/`.
- [x] Adotar o schema remoto capturado como baseline `20260617172638` e preservar a ordem do hardening posterior.
- [x] Capturar o schema remoto atual com `supabase db dump --linked --schema public,private` e comparar o resultado com os SQLs de segurança.
- [x] Aplicar somente a migration corretiva `20260810120000_security_privilege_reconciliation.sql`, sem reparar artificialmente o histórico remoto.
- [ ] Adicionar uma etapa de CI que detecte drift de schema/policies antes de release.

### Critério de aceite

Um banco novo, inicializado exclusivamente pelas migrations versionadas, possui as mesmas tabelas, policies, grants, funções e triggers de segurança da instância remota validada.

A baseline e a correção de privilégios estão versionadas e aplicadas no remoto. Ainda falta validar a reconstrução completa em um banco novo/staging antes de marcar este critério como concluído.

## Prioridade 1 — Teste HTTP com `anon key` e dois usuários reais

O teste SQL atual exercita o banco usando os mesmos papéis e claims JWT consumidos pelo PostgREST. Falta apenas validar o caminho completo HTTP: autenticação, emissão de JWT e chamadas pelo cliente público.

### Ambiente necessário

Criar duas contas descartáveis e isoladas, sem privilégios administrativos. Fornecer somente em ambiente local seguro ou em um Environment protegido do GitHub:

```text
SUPABASE_TEST_ANON_KEY
SUPABASE_TEST_USER_A_EMAIL
SUPABASE_TEST_USER_A_PASSWORD
SUPABASE_TEST_USER_B_EMAIL
SUPABASE_TEST_USER_B_PASSWORD
```

Não versionar essas variáveis, não usar contas pessoais e não usar `service_role` no teste de cliente.

O harness está em `scripts/supabase-http-security-test.mjs` e exige `SUPABASE_TEST_ENVIRONMENT=staging`; ele recusa execução em qualquer outro ambiente. O workflow manual `.github/workflows/supabase-staging-security.yml` usa o GitHub Environment `staging` e não recebe credenciais de banco ou `service_role`.

### Casos obrigatórios

- [ ] Autenticar A e B via endpoint Auth usando a `anon key`.
- [ ] Criar fixtures exclusivamente pelos endpoints PostgREST/RPC autenticados.
- [ ] Confirmar que A não lista, atualiza ou remove dados de B em `profiles`, `purchases`, `items`, `shopping_lists` e `shopping_list_items`.
- [ ] Confirmar que `anon` recebe negação para tabelas privadas, analytics e auditoria.
- [ ] Confirmar que a RPC `create_purchase_with_items` rejeita identificadores de supermercado pertencentes a B.
- [ ] Limpar as fixtures identificadas ao final, mesmo quando o teste falhar.

### Critério de aceite

O teste roda contra uma instância de staging dedicada, usa apenas `anon key` e sessões reais, e não grava dados no ambiente de produção.

## Prioridade 1 — Automação contínua do Supabase

### Ações

- [ ] Rodar `supabase_security_hardening_smoke_test.sql` após cada migration de segurança em staging.
- [ ] Rodar `supabase_security_rls_integration_test.sql` manualmente em produção após aprovação, ou automaticamente apenas em staging.
- [ ] Criar um job CI separado para o teste HTTP, protegido por Environment e secrets de teste.
- [ ] Fazer o job falhar ao encontrar RPC `SECURITY DEFINER` executável por `anon` ou `authenticated`.
- [ ] Registrar a versão/schema alvo no resultado do job, sem imprimir chaves, JWTs ou payloads de usuário.

### Regra operacional

Nunca disponibilizar credenciais de banco, `service_role` ou `SUPABASE_ACCESS_TOKEN` a workflows disparados por forks ou pull requests não confiáveis.

## Prioridade 2 — Testes de regressão da sanitização Sentry

Criar testes unitários para a configuração Sentry e garantir que mudanças futuras não restaurem a coleta de dados pessoais.

### Casos mínimos

- [ ] E-mail é substituído por `[redacted-email]`.
- [ ] URL NFC-e é substituída por `[redacted-url]`.
- [ ] JWT ou token Bearer é substituído por `[redacted-token]`.
- [ ] Chave NFC-e de 44 dígitos é substituída por `[redacted-nfce-key]`.
- [ ] `beforeSend` remove `user`, `request`, `extra`, `contexts`, breadcrumbs e stacktrace antes do envio.

### Critério de aceite

Os testes falham se qualquer campo sensível voltar a ser transmitido ao Sentry.

## Prioridade 2 — Scanner especializado de segredos

O script `scripts/secret-scan.sh` é uma defesa complementar; ele não substitui análise por entropia e regras de provedores.

### Ações

- [ ] Adicionar Gitleaks ao CI como scanner recomendado.
- [ ] Executar em arquivos alterados e histórico relevante em pull requests.
- [ ] Configurar baseline apenas para falsos positivos revisados; nunca mascarar uma credencial real.
- [ ] Habilitar GitHub Secret Scanning e Push Protection, se disponíveis no repositório.

## Prioridade 2 — Auditoria do APK release assinado

A ausência de `RECORD_AUDIO` foi validada no APK debug e no manifesto release processado. A próxima auditoria deve usar o APK release final, assinado e equivalente ao publicado.

### Checklist

- [ ] `aapt dump permissions app-release.apk` contém somente permissões justificadas.
- [ ] `aapt dump badging app-release.apk` confirma `com.prati.meugasto`, versão e `targetSdk` esperados.
- [ ] `apksigner verify --verbose app-release.apk` passa.
- [ ] Manifesto release usa `android:debuggable="false"`.
- [ ] Release não habilita HTTP cleartext (`usesCleartextTraffic=false`).
- [ ] Backup Android é desabilitado ou limitado pelas regras compatíveis com `expo-secure-store`.
- [ ] Deep links são restritos ao esquema necessário.
- [ ] Rastrear e bloquear, quando sem uso comprovado: `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `USE_BIOMETRIC`, `USE_FINGERPRINT` e `VIBRATE`.

Não alterar uma permissão apenas pelo nome: usar o relatório do Android manifest merger para identificar a dependência de origem e validar a funcionalidade após o bloqueio.

## Prioridade 2 — Corpus adversarial para NFC-e e WebView

Ampliar testes unitários existentes com entradas que simulem QR Codes e redirecionamentos hostis.

- [ ] URL `http://`.
- [ ] Host semelhante a domínio oficial, Unicode confusável e caracteres de controle.
- [ ] Redirect para host externo.
- [ ] Caminho codificado/malformado e payload excessivamente grande.
- [ ] Esquemas `intent:`, `file:`, `content:`, `javascript:` e `data:`.
- [ ] Mensagem `postMessage` de frame não principal.
- [ ] Casos reais anonimizados de portais SEFAZ dos estados suportados.

## Prioridade 3 — Proteções operacionais do GitHub

Estas verificações dependem da configuração da organização/repositório e não podem ser provadas apenas pelo Git local.

- [ ] `main` protegida e sem push direto.
- [ ] Pull request e checks de qualidade obrigatórios antes de merge.
- [ ] Alterações em GitHub Actions requerem aprovação de mantenedor confiável.
- [ ] Secrets de produção isolados em GitHub Environments protegidos.
- [ ] Acesso mínimo a `EXPO_TOKEN`, material de assinatura Android e token Sentry.
- [ ] Workflow com `contents: write` pode ser disparado somente por pessoas confiáveis e tags válidas `vX.Y.Z.W`.

## Prioridade 3 — Plano de resposta a exposição de credenciais

Antes de qualquer rotação de assinatura Android, criar um plano revisado que cubra:

1. Inventário de onde cada segredo foi visto.
2. Rotação de tokens Sentry e outros tokens expostos, quando aplicável.
3. Avaliação de troca de senha do keystore mantendo o mesmo certificado/chave, se suportada.
4. Teste de atualização sobre APK já instalado.
5. Novo release assinado e verificado.
6. Registro do incidente sem incluir a credencial em si.

Não rotacionar o certificado/chave de assinatura Android sem plano de continuidade: isso pode impedir atualizações para instalações existentes.

## Comandos de referência

```bash
# Consulta e aplicação de SQL na instância vinculada.
supabase db query --linked --file mobile/supabase_security_hardening_smoke_test.sql
supabase db query --linked --file mobile/supabase_security_rls_integration_test.sql

# Auditoria local de dependências e segredos.
npm --prefix mobile audit --audit-level=high
npm --prefix mobile run typecheck
bash scripts/secret-scan.sh

# Auditoria de APK release.
aapt dump badging app-release.apk
aapt dump permissions app-release.apk
apksigner verify --verbose app-release.apk
```

## Evidências que devem acompanhar mudanças futuras

Para qualquer alteração em schema, policies, RPCs, permissões Android ou observabilidade, anexar ao pull request:

- migration e ordem de aplicação;
- resultado do teste específico;
- impacto sobre dados existentes;
- plano de rollback ou recuperação;
- confirmação de que nenhuma chave, JWT, e-mail real, NFC-e ou dado individual foi incluído em logs, artefatos ou documentação.
