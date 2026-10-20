# cloud sync + single login

## User usage

```
Não logado (LOCAL_FIRST)
  Perfil / Ajustes -> "Entrar na Nuvem" -> LoginScreen(email, senha)
      sucesso: grava sessão, AppMode = CLOUD, sincroniza compras, volta ao Dashboard

Logado (CLOUD)
  App abre   -> restaura sessão -> sincroniza em background -> Dashboard mostra os gastos
  Perfil     -> "Sair" -> limpa sessão -> AppMode = LOCAL_FIRST
```

## Grounding (Phase A)

- `DashboardScreen`/`ReportsScreen`/`PurchasesScreen` leem `PurchaseRepository.getPurchases()` (Flow da Room). Room é o único read model.
- `MeuGastoApp` cria `LocalPurchaseRepository(database)` e o expõe.
- `UserPreferences` já guarda access/refresh token (EncryptedSharedPreferences) e `appMode`.
- `SettingsScreen` grava token falso `token_cloud_session`; não existe cliente Supabase no código.
- Produção: `https://xiguamctjwnezbzjipwl.supabase.co`, `mailer_autoconfirm=true`, RLS por `user_id`.
- Schema remoto: `purchases(id,user_id,supermarket_id,date,total_price,manual,created_at,updated_at)`, `items(id,purchase_id,name,code,category_id,quantity,unit,price)`, `supermarkets(id,user_id,name,cnpj,city,state,manual,created_at)`.

## Candidate A (escolhido) — Room como espelho do remoto

Cloud→Room mirror. `remoteId` nas entidades. Sync idempotente. Todos os ecrãs (dashboard, relatórios, histórico) passam a ver dados cloud sem alterações.

## Candidate B (rejeitado) — `SupabasePurchaseRepository` trocado em runtime

Dashboard leria da rede. Menos código, mas `Reports`/`ProductHistory`/`Purchases` continuam a ler a Room e ficariam vazios em modo cloud. Rejeitado por partir o read model único.

## Decisão

Candidate A. Superfície pequena: `SupabaseApi` (rede), `CloudPurchaseSync` (mapa+upsert), migração Room v3, `SupabaseAuthRepository` (sessão), uma tela `LoginScreen`. Nada mais troca de repositório.

## Tipos

`data/remote/supabase/SupabaseApi.kt`
- DTOs `@Serializable`: `RemoteAuthSession(access_token, refresh_token, user)`, `RemoteUser(id,email,user_metadata)`, `RemotePurchase(id,date,total_price,manual,created_at,updated_at,supermarket,items)`, `RemoteSupermarket`, `RemoteItem`.
- `class SupabaseApi(baseUrl, anonKey, http)`:
  - `signIn(email,password): RemoteAuthSession`
  - `signUp(email,password,name): RemoteAuthSession?`
  - `refresh(refreshToken): RemoteAuthSession`
  - `fetchPurchases(accessToken): List<RemotePurchase>`

`data/remote/supabase/CloudPurchaseSync.kt`
- `class CloudPurchaseSync(db)`: `suspend fun sync(remote: List<RemotePurchase>): Int`
- upsert por `remoteId` (supermarket -> purchase -> items delete+insert), dentro de `withTransaction`.

`data/remote/supabase/SupabaseAuthRepository.kt`
- `sealed interface AuthState { LoggedOut; LoggedIn(userId,email,name) }`
- `class SupabaseAuthRepository(api, prefs)`: `authState: StateFlow`, `signIn`, `signUp`, `signOut`, `restore()`, `accessToken(): String?` (refresh se 401).

`data/local/database/*` v3
- `remoteId: Long?` + unique index em `supermarkets`, `purchases`, `items`.
- DAO: `findIdByRemoteId`, `updatePurchaseInPlace`.

Wiring
- `MeuGastoApp`: `supabaseApi`, `authRepository`, `cloudSync`.
- `MainActivity`: `LaunchedEffect` restaura sessão + sincroniza quando CLOUD.
- `Screen.Login` + `LoginScreen`; Settings/Profile chamam-na. Remove token falso.

## Contrato de erro

Falha de rede em sync não apaga dados locais. Login inválido mostra mensagem genérica. Sem credenciais configuradas, o botão de nuvem fica desabilitado com aviso.

## Fora de âmbito (registar)

- Upload de compras novas locais para a cloud (scan offline). Follow-up.
- Refresh token proativo por `exp`. Faz refresh reativo em 401.

## Verificação (device SM-A325M, Android 13)

- Supabase falso local + `adb reverse tcp:8787`. `mailer_autoconfirm` real confirmado no prod.
- Login na tela nova -> Dashboard passou de R$ 0,00 para R$ 249,42 / 2 compras / 4 itens.
- Reinício do app (sem novo login) manteve R$ 249,42 / 2 compras: sync no arranque e idempotência provados.
- Defeito extra encontrado e corrigido: `app_mode=CLOUD` podia persistir sem sessão; agora normaliza para LOCAL_FIRST.

