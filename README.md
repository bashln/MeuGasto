# MeuGasto

Aplicação mobile para gerenciamento inteligente de compras em mercados.

Foco em controle de gastos, organização de compras e integração com NFC-e.
Arquitetura preparada para evolução para modelo SaaS.

## Download

Baixe a versão mais recente diretamente na seção de [Releases](https://github.com/bashln/MeuGasto/releases).

Os APKs são gerados automaticamente via GitHub Actions para tags no formato `vX.Y.Z.W`.

## Stack

- Mobile: Expo + React Native + TypeScript
- Backend: Supabase (Auth, Postgres, RLS)
- Build Android: GitHub Actions (APK Standalone) / EAS Build

## Estrutura

```
.
├── docs/                      # Documentação do projeto
│   ├── index.md               # Índice da documentação
│   ├── architecture/
│   ├── audits/
│   ├── status/
│   ├── process/
│   └── ai/
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

Schema do banco (referência): `mobile/supabase_schema.sql`.

Para uma instalação nova, aplique `mobile/supabase_schema.sql`,
`mobile/supabase_privacy_migration.sql`, `mobile/supabase_price_comparison_migration.sql`
e, por último, `mobile/supabase_security_hardening_migration.sql`. O hardening restringe
referências entre usuários, acesso aos analytics, escrita no log de auditoria e abuso
de recursos com quotas e limites horários de escrita por usuário. Valide a sequência
completa primeiro em uma branch de staging do Supabase; nunca use o banco de produção
como ambiente de ensaio.

Depois de aplicar o hardening em staging, execute
`mobile/supabase_security_hardening_smoke_test.sql` com `ON_ERROR_STOP=1` para
confirmar RLS, privilégios e todos os triggers de rate limit antes da promoção.

O plano para cumprir literalmente a promessa de administração sem acesso aos gastos
está em `docs/adr/0001-admin-blind-e2ee.md`. Ele exige migração gradual e novo APK;
não é uma alteração compatível apenas com OTA.

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
