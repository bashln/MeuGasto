# Politica e Arquitetura de Seguranca do MeuGasto

**Versao:** 2.0.0  
**Stack ativa:** Android nativo (Kotlin, Jetpack Compose, Room, Ktor/OkHttp) + Supabase (PostgreSQL, GoTrue, RLS)

---

## 1. Modelo de Armazenamento e Privacidade

O aplicativo opera em dois modos explicitos escolhidos pelo usuario.

- **Local-First (padrao).** Compras, itens e listas permanecem no banco SQLite local (`Room`) dentro do sandbox privado do app (`android:allowBackup="false"`). A chave de acesso NFC-e de 44 digitos nao e gravada em texto puro no disco nesse modo; apenas o hash SHA-256 (`accessKeyHash`) e persistido para evitar notas duplicadas.
- **Modo Nuvem (opcional).** Os dados sao enviados via TLS ao Supabase e isolados por usuario com Row Level Security (`auth.uid()`). A criptografia ponta a ponta cega ao administrador permanece registrada como trabalho futuro em `docs/adr/0001-admin-blind-e2ee.md` e nao e prometida na interface antes de sua entrega.

---

## 2. Controles Tecnicos Ativos

### Sessao e Credenciais Locais
- Tokens de sessao (`access_token`, `refresh_token`) sao gravados com `EncryptedSharedPreferences` apoiado no Android Keystore (`AES256_SIV` / `AES256_GCM`) em `UserPreferences.kt`.
- Se o keyset local corromper, o app limpa o arquivo corrompido e recria o armazenamento criptografado uma vez. Se o Keystore do aparelho falhar de forma permanente, a sessao cai para memoria volatil (`InMemorySharedPreferences`) e nunca grava tokens em disco aberto.
- A troca de senha em `ProfileScreen.kt` exige reautenticacao com a senha atual antes de chamar `PUT /auth/v1/user`.

### Consulta NFC-e Direta nas SEFAZ
- O cliente consulta apenas portais estaduais listados em `NfceStateRegistry.kt` sobre `https://`.
- Redirecionamentos HTTP sao validados salto a salto contra a mesma lista de hosts permitidos e esquema `https`, bloqueando downgrade para `http://` ou escape para dominios externos.
- O HTML recebido possui teto de leitura antes do parsing em `NfcePortalDataParser.kt` e da validacao de limites em `NfcePayloadValidator.kt`.

### Banco de Dados e RPC Supabase
- A funcao `public.create_purchase_with_items(integer, text, date, numeric, boolean, jsonb)` deriva o usuario exclusivamente de `auth.uid()`, valida formato e limites dos itens e converte a chave NFC-e de 44 digitos em HMAC-SHA256 (`access_key_hash`) no servidor.
- A sobrecarga legada de 7 argumentos com `p_user_id` explicito foi revogada e removida em `supabase/migrations/20260811120000_revoke_legacy_purchase_rpc_and_constraints.sql`.
- Tabelas `analytics_*` nao contem `user_id`, `purchase_id` ou e-mail e tem leitura revogada para `PUBLIC`, `anon` e `authenticated`.
- Escritas autenticadas possuem quotas por linha e rate limit atomico no schema `private`.

### Permissoes Android, Atualizador In-App e Assinatura
- `AndroidManifest.xml` bloqueia `android.permission.RECORD_AUDIO` com `tools:node="remove"`.
- `FileProvider` compartilha exclusivamente `cacheDir/updates/` (`res/xml/file_paths.xml`).
- `InAppUpdateManager.kt` exige status HTTP 2xx, restringe downloads e redirecionamentos a `https://` nos hosts oficiais do GitHub Releases, grava por streaming com limite de tamanho e valida assinatura estrutural ZIP (`PK\x03\x04`) antes de acionar o instalador do Android.
- O workflow `.github/workflows/release.yml` mantem o `applicationId` e o keystore imutaveis para continuidade de atualizacao e executa `apksigner verify` no APK antes de publicar a release.

---

## 3. Verificacao Continua (Pre-Commit e CI)

Execute os quatro comandos abaixo na raiz do repositorio antes de abrir ou atualizar releases.

```bash
bash scripts/privacy-check.sh
bash scripts/secret-scan.sh
node --test scripts/dependency-audit.test.mjs
(cd mobile && ./gradlew testDebugUnitTest)
```

---

## 4. Reporte de Vulnerabilidades

Nao abra issues publicas com detalhes exploraveis de seguranca ou credenciais. Utilize o canal privado de Security Advisories do repositorio GitHub (`Security > Report a vulnerability`) com passos de reproducao, impacto e versao afetada.
