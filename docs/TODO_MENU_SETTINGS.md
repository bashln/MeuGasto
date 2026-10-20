# TODO: Menu e Configurações Completas

## Objetivo

Criar um menu de configurações profissional e organizado, com seções claras para tema, notificações, conta, dados e sobre.

## Estrutura Atual

- SettingsScreen: apenas toggle Modo Nuvem/Local + WebDAV + Updates
- Acessível apenas pelo ícone no TopBar do Dashboard
- Sem seções organizadas, sem tema, sem notificações

## Estrutura Proposta

### Menu Principal (SettingsScreen)

```
Configurações
│
├── 👤 Conta
│   ├── Perfil (nome, email, avatar)
│   ├── Plano atual (Local / Nuvem)
│   ├── Gerenciar assinatura (futuro)
│   └── Sair da conta
│
├── 🎨 Aparência
│   ├── Tema (Claro / Escuro / Sistema)
│   ├── Cores (Dinâmica / Personalizada)
│   └── Tamanho da fonte
│
├── 🔔 Notificações
│   ├── Lembretes de compra
│   │   ├── Ativado / Desativado
│   │   ├── Horário preferido
│   │   └── Frequência (Diária / Semanal)
│   ├── Alertas de preço
│   │   ├── Ativado / Desativado
│   │   └── Threshold (ex: "avisar se subir > 10%")
│   └── Novidades do app
│
├── 📦 Dados e Armazenamento
│   ├── Modo de armazenamento (Local / Nuvem)
│   ├── Status de sincronização
│   ├── Último backup
│   ├── Servidor WebDAV (configurar)
│   ├── Exportar dados (JSON/CSV)
│   └── Importar dados
│
├── 🛒 Compras
│   ├── Moeda padrão (BRL)
│   ├── Produto padrão por unidade
│   └── Histórico de comparações
│
├── 🔒 Privacidade e Segurança
│   ├── Modo anônimo (sem sync)
│   ├── Criptografia de dados locais
│   ├── Gerenciar dados pessoais
│   └── Excluir todos os dados
│
├── ℹ️ Sobre
│   ├── Versão do app
│   ├── Verificar atualizações
│   ├── Licenças open source
│   ├── Política de privacidade
│   ├── Código fonte (GitHub)
│   └── Contato / Feedback
│
└── 🧪 Desenvolvedor (oculto, ativar com 7 taps)
    ├── Logs de depuração
    ├── URLs de teste
    └── Resetar onboarding
```

## Componentes UI

### SettingsSection

```kotlin
@Composable
fun SettingsSection(
    title: String,
    icon: ImageVector,
    content: @Composable ColumnScope.() -> Unit
)
```

### SettingsRow

```kotlin
@Composable
fun SettingsRow(
    title: String,
    subtitle: String? = null,
    icon: ImageVector? = null,
    trailing: @Composable (() -> Unit)? = null,
    onClick: (() -> Unit)? = null
)
```

### SettingsToggle

```kotlin
@Composable
fun SettingsToggle(
    title: String,
    subtitle: String? = null,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
)
```

### SettingsNavigation

```kotlin
@Composable
fun SettingsNavigation(
    title: String,
    subtitle: String? = null,
    icon: ImageVector? = null,
    badge: String? = null,
    onClick: () -> Unit
)
```

## Implementação de Tema

### Seleção de Tema

```kotlin
enum class ThemeMode { LIGHT, DARK, SYSTEM }

// Salvar preferência
preferences.setThemeMode(ThemeMode.DARK)

// Aplicar no Theme
val themeMode = preferences.getThemeMode()
val darkTheme = when (themeMode) {
    ThemeMode.LIGHT -> false
    ThemeMode.DARK -> true
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
}

MeuGastoTheme(darkTheme = darkTheme) { ... }
```

### Dynamic Color Toggle

```kotlin
// Salvar
preferences.setDynamicColor(enabled: Boolean)

// Aplicar
val dynamicColor = preferences.getDynamicColor()
MeuGastoTheme(dynamicColor = dynamicColor) { ... }
```

## Implementação de Notificações

### Tipos de Notificação

| Tipo | Trigger | Ação |
|------|---------|------|
| Lembrete de compra | Horário agendado | Notificação com CTA para Scanner |
| Alerta de preço | Preço > threshold | Notificação com detalhes do produto |
| Novidade | Nova versão disponível | Notificação com changelog |

### Agendamento

```kotlin
// Lembrete de compra
WorkManager.enqueueUniqueWork(
    "shopping_reminder",
    ExistingWorkPolicy.KEEP,
    PeriodicWorkRequestBuilder<ShoppingReminderWorker>(1, TimeUnit.DAYS)
        .setInitialDelay(calculateDelay(), TimeUnit.MILLISECONDS)
        .build()
)
```

### Worker

```kotlin
class ShoppingReminderWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        // Verificar se há itens na lista de compras
        // Enviar notificação se houver
        return Result.success()
    }
}
```

## Integração com Bottom Navigation

### Menu de Navegação Atualizado

```
Bottom Nav:
├── Início (Dashboard)
├── Compras
├── Escanear (FAB central)
├── Listas
└── Menu (novo, substitui Relatórios)
    ├── Relatórios
    ├── Configurações
    └── Perfil
```

Ou manter 5 tabs e acessar Configurações pelo ícone no TopBar (implementação atual).

## Localização no Código

- **Novos arquivos**: `mobile/app/src/main/kotlin/com/prati/meugasto/ui/screens/settings/`
- **Components**: `mobile/app/src/main/kotlin/com/prati/meugasto/ui/components/settings/`
- **Workers**: `mobile/app/src/main/kotlin/com/prati/meugasto/notifications/`
- **Preferences**: Atualizar `UserPreferences.kt` com novas preferências

## Prioridade

**Fase 4** — Junto com auth e antes da release.

## Acceptance Criteria

- [ ] Menu organizado em seções com ícones
- [ ] Tema Claro/Escuro/Sistema funciona
- [ ] Dynamic Color toggle funciona
- [ ] Lembrete de compra agenda notificação
- [ ] Alerta de preço dispara quando threshold atingido
- [ ] Exportar dados gera JSON/CSV
- [ ] WebDAV configuração funciona
- [ ] Excluir dados limpa tudo com confirmação
- [ ] Versão do app exibida corretamente
- [ ] Verificar atualizações funciona
- [ ] Licenças open source exibidas
- [ ] Menu do desenvolvedor oculto com 7 taps
