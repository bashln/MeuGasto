# MeuGasto

Aplicação mobile para gerenciamento inteligente de compras em mercados.

Foco em controle de gastos, organização de compras e integração com NFC-e.
Arquitetura preparada para evolução para modelo SaaS.

## Download

Baixe a versão mais recente diretamente na seção de [Releases](https://github.com/bashln/MeuGasto/releases).

Os APKs são gerados automaticamente via GitHub Actions a cada nova tag de versão (`v*`).

## Stack

- Mobile: Expo + React Native + TypeScript
- Backend: Supabase (Auth, Postgres, RLS)
- Build Android: GitHub Actions (APK Standalone) / EAS Build

## Estrutura

```
.
├── mobile/                    # Aplicativo Expo
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── screens/           # Telas
│   │   ├── services/          # Integrações com Supabase
│   │   ├── context/           # Contextos React
│   │   ├── types/             # Tipos TypeScript
│   │   ├── utils/             # Funções auxiliares
│   │   ├── navigation/        # React Navigation
│   │   └── lib/               # Configurações (Supabase)
│   ├── assets/
│   └── supabase_schema.sql    # Estrutura inicial do banco
└── ...
```

## Executando em Desenvolvimento

```bash
cd mobile
npm install
npx expo start
```

Limpar cache se necessário:

```bash
npx expo start --clear
```

Comandos úteis:

```bash
cd mobile
npx tsc --noEmit
```

## Variáveis de Ambiente

Criar `.env` dentro de `mobile/` (apenas `EXPO_PUBLIC_`):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_AUTH_REDIRECT_URL=https://app.example.com/auth/callback
```

Nao armazene segredos de assinatura Android em `mobile/.env`.

Schema do banco (referência): `mobile/supabase_schema.sql`

## Build Android (Preview)

```bash
cd mobile
eas build -p android --profile preview
```

## Android em Dispositivo

`debug` em aparelho fisico depende do Metro. O APK `debug` nao e standalone.

```bash
cd mobile
npm run android:build:device:debug
npm run android:install:device:debug
npm run android:start:device:debug
```

Se o app ja estiver instalado em `debug`, tambem funciona:

```bash
cd mobile
npm run android:reverse
npx expo start --dev-client
```

`release` local gera APK standalone, mas exige keystore configurado:

```bash
cd mobile
export MEUGASTO_SIGNING_ENV_FILE=~/.config/meugasto/release-signing.env
npm run android:build:release:local
```

## Troubleshooting Android

### Splash presa no APK debug

Se o app abrir e ficar parado na splash por muito tempo, siga este checklist antes de mexer na arquitetura:

1. Confirme se o app debug esta com Metro ativo e `adb reverse tcp:8081 tcp:8081`.
2. Rode `adb shell dumpsys activity activities | rg "com\\.prati\\.meugasto|startingWindow"` para ver se a `startingWindow` ainda esta presa.
3. Rode `adb logcat -d -v time --pid=$(adb shell pidof com.prati.meugasto)` e procure erros JS antes do primeiro frame.
4. Se aparecer `Gradient package was not found`, confirme que [`expo-linear-gradient`](./mobile/package.json) continua instalado. `react-native-gifted-charts` depende dele no boot do bundle.
5. Se a `startingWindow` continuar presa mesmo sem erro JS, revalide o watchdog nativo em [`MainActivity.kt`](./mobile/android/app/src/main/java/com/prati/meugasto/MainActivity.kt).

Correcoes que ja ficaram aplicadas no projeto:

- o app nao retorna mais `null` durante o bootstrap de auth; usa `Loading fullScreen`
- o bootstrap de splash deixou de depender do `AuthContext`
- existe um watchdog nativo em `MainActivity.kt` para liberar a splash se o auto-hide do Expo falhar
- `expo-linear-gradient` foi adicionado porque a falta dessa dependencia fazia o JS morrer antes do primeiro frame

Sinal atual esperado no debug:

- a splash pode durar alguns segundos com Metro, mas nao deve ficar indefinidamente
- o `dumpsys` deve perder a `startingWindow` apos o app terminar o boot
- o processo JS deve chegar em `Running "main"` sem erro fatal

## NFC-e

O fluxo de leitura da NFC-e usa WebView para carregar a URL do QR Code e
executar o scraping no componente `mobile/src/components/NFCeWebView.tsx`.
Os dados extraídos são usados para criar rascunhos e compras no app.

## Status

Fase atual: Alpha (builds automáticos e funcionais disponíveis em Releases).

## Licença

Este projeto é distribuído sob a licença GNU AGPLv3.

O código pode ser usado, modificado e redistribuído livremente,
desde que qualquer uso como serviço acessível via rede também
disponibilize o código-fonte das modificações.

## Dependências externas

- Portais estaduais da SEFAZ para consulta da NFC-e
- nfce-scraper (https://nfce-scraper.herokuapp.com) como fallback para consulta
- Serviços de terceiros podem ficar indisponíveis ou mudar sem aviso
