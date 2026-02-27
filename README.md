# Projeto Mercado

Aplicação mobile para gerenciamento inteligente de compras em mercados.

Foco em controle de gastos, organização de compras e integração com NFC-e.
Arquitetura preparada para evolução para modelo SaaS.

## Stack

- Mobile: Expo + React Native + TypeScript
- Backend: Supabase (Auth, Postgres, RLS)
- Database: PostgreSQL
- Build Android: EAS Build

## Estrutura

```
.
├── mobile/                    # Aplicativo Expo
│   ├── src/
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

## Variáveis de Ambiente

Criar `.env` dentro de `mobile/`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Build Android (Preview)

```bash
cd mobile
eas build -p android --profile preview
```

## Status

Fase atual: Pre-Alpha (validação funcional em dispositivos reais).

## Licença

Este projeto é distribuído sob a licença GNU AGPLv3.

O código pode ser usado, modificado e redistribuído livremente,
desde que qualquer uso como serviço acessível via rede também
disponibilize o código-fonte das modificações.
