# MeuGasto

Aplicação mobile para gerenciamento inteligente de compras em mercados.

Foco em controle de gastos, organização de compras e integração com NFC-e.
Arquitetura preparada para evolução para modelo SaaS.

## Stack

- Mobile: Expo + React Native + TypeScript
- Backend: Supabase (Auth, Postgres, RLS)
- Build Android: EAS Build

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
```

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
export MEUGASTO_STORE_FILE=/caminho/para/seu-release.jks
export MEUGASTO_STORE_PASSWORD=...
export MEUGASTO_KEY_ALIAS=...
export MEUGASTO_KEY_PASSWORD=...
npm run android:build:release:local
```

## NFC-e

O fluxo de leitura da NFC-e usa WebView para carregar a URL do QR Code e
executar o scraping no componente `mobile/src/components/NFCeWebView.tsx`.
Os dados extraídos são usados para criar rascunhos e compras no app.

## Status

Fase atual: Pre-Alpha (validação funcional em dispositivos reais).

## Licença

Este projeto é distribuído sob a licença GNU AGPLv3.

O código pode ser usado, modificado e redistribuído livremente,
desde que qualquer uso como serviço acessível via rede também
disponibilize o código-fonte das modificações.

## Dependências externas

- Portais estaduais da SEFAZ para consulta da NFC-e
- nfce-scraper (https://nfce-scraper.herokuapp.com) como fallback para consulta
- Serviços de terceiros podem ficar indisponíveis ou mudar sem aviso
