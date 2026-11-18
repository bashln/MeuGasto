# TODO: Área de Login e Perfil de Usuário (Supabase)

## Objetivo

Implementar fluxo completo de autenticação via Supabase para usuários que escolhem o Modo Nuvem, incluindo login, cadastro, recuperação de senha e perfil.

## Contexto Atual

- Modo Nuvem (Supabase) já existe como opção no Onboarding
- `UserPreferences` já tem `saveAuthTokens()`, `getAccessToken()`, `getRefreshToken()`, `clearAuth()`
- `BuildConfig` expõe `SUPABASE_URL` e `SUPABASE_ANON_KEY`
- Dependência `@supabase/supabase-js` já instalada no React Native
- No app nativo, Supabase GoTrue e Postgrest já estão nas dependências Gradle

## Fluxos

### 1. Login

```
Tela de Login
├── Email input
├── Senha input
├── Botão "Entrar"
├── Link "Esqueci minha senha"
└── Link "Criar conta"
```

**Regras:**
- Email obrigatório, formato válido
- Senha mínima 6 caracteres
- Mostrar erro genérico (não revelar se email existe)
- Loading state durante requisição
- Sucesso → salvar tokens → ir para Dashboard

### 2. Cadastro

```
Tela de Cadastro
├── Nome completo input
├── Email input
├── Senha input
├── Confirmar senha input
├── Botão "Criar Conta"
└── Link "Já tenho conta"
```

**Regras:**
- Senhas devem coincidir
- Email único (Supabase RLS cuida disso)
- Após cadastro → enviar email de confirmação
- Redirecionar para tela de "Verifique seu email"

### 3. Recuperação de Senha

```
Tela de Recuperação
├── Email input
├── Botão "Enviar link de recuperação"
└── Mensagem "Se o email existir, você receberá um link"
```

**Regras:**
- Nunca revelar se o email existe ou não
- Mensagem genérica sempre
- Supabase envia email automaticamente

### 4. Perfil do Usuário

```
Tela de Perfil
├── Avatar (placeholder ou iniciais)
├── Nome
├── Email
├── Plano (Local/Cloud)
├── Membro desde
├── Opções:
│   ├── Editar perfil
│   ├── Alterar senha
│   ├── Sair da conta
│   └── Excluir conta (perigoso)
```

### 5. Verificação de Status

```
App Start
├── Tokens existem?
│   ├── Sim → Validar token com Supabase
│   │   ├── Válido → Dashboard
│   │   └── Inválido → Refresh token
│   │       ├── Sucesso → Dashboard
│   │       └── Falha → Login
│   └── Não → Onboarding ou Login
```

## Implementação

### Supabase Client

```kotlin
// data/remote/supabase/SupabaseClient.kt
object SupabaseClient {
    private var client: SupabaseClient? = null
    
    fun initialize(url: String, anonKey: String) {
        client = createSupabaseClient(url, anonKey) {
            install(Auth)
            install(Postgrest)
        }
    }
    
    fun getClient(): SupabaseClient = client 
        ?: throw IllegalStateException("Supabase not initialized")
}
```

### Auth Repository

```kotlin
// data/remote/supabase/SupabaseAuthRepository.kt
interface AuthRepository {
    suspend fun signIn(email: String, password: String): Result<User>
    suspend fun signUp(email: String, password: String, name: String): Result<User>
    suspend fun signOut(): Result<Unit>
    suspend fun resetPassword(email: String): Result<Unit>
    suspend fun getCurrentUser(): User?
    suspend fun updateProfile(name: String): Result<Unit>
    suspend fun changePassword(newPassword: String): Result<Unit>
    suspend fun deleteAccount(): Result<Unit>
}

data class User(
    val id: String,
    val email: String,
    val name: String?,
    val createdAt: String
)
```

### Telas

| Tela | Arquivo | Status |
|------|---------|--------|
| LoginScreen | `ui/screens/auth/LoginScreen.kt` | Novo |
| SignUpScreen | `ui/screens/auth/SignUpScreen.kt` | Novo |
| ForgotPasswordScreen | `ui/screens/auth/ForgotPasswordScreen.kt` | Novo |
| ProfileScreen | `ui/screens/auth/ProfileScreen.kt` | Novo |
| EmailVerificationScreen | `ui/screens/auth/EmailVerificationScreen.kt` | Novo |

### Navegação

```
Auth NavHost (não autenticado)
├── Login → SignUp
├── Login → ForgotPassword
└── SignUp → EmailVerification

App NavHost (autenticado)
├── Dashboard → Profile
├── Settings → Profile
└── Profile → ChangePassword, SignOut, DeleteAccount
```

### Tokens e Sessão

```kotlin
// Salvar tokens
preferences.saveAuthTokens(accessToken, refreshToken)

// Verificar sessão
val session = supabase.auth.currentSessionOrNull()
if (session == null || session.isExpired()) {
    // Tentar refresh ou redirecionar para login
}

// Logout
supabase.auth.signOut()
preferences.clearAuth()
```

## Localização no Código

- **Novos arquivos**: `mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/auth/`
- **Repository**: `mobile/app/src/main/kotlin/com/prati/meugasto/data/remote/supabase/`
- **Preferences**: `mobile/app/src/main/kotlin/com/prati/meugasto/data/local/preferences/UserPreferences.kt`
- **Navigation**: Atualizar `Navigation.kt` e `MainActivity.kt`

## Prioridade

**Fase 4** — Após Fase 3 (analytics) e antes da release pública.

## Acceptance Criteria

- [ ] Login com email/senha funciona via Supabase
- [ ] Cadastro cria conta e envia email de confirmação
- [ ] Recuperação de senha envia link (não revela existência)
- [ ] Token refresh automático
- [ ] Logout limpa tokens e redireciona
- [ ] Perfil mostra dados do usuário
- [ ] Alterar senha funciona
- [ ] Excluir conta funciona (com confirmação dupla)
- [ ] Modo Local continua funcionando sem login
- [ ] Transição entre Modo Local e Modo Nuvem preserva dados
