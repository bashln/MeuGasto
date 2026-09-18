# Assinatura local de release Android

Credenciais de assinatura nunca devem ficar no checkout do projeto, mesmo em arquivos ignorados. O build local lê variáveis públicas de `mobile/.env` e as credenciais de assinatura de um arquivo externo.

## Arquivo de credenciais

Crie `~/.config/meugasto/release.env` com permissão `0600`:

```bash
MEUGASTO_STORE_FILE=/caminho/absoluto/meugasto-release.jks
MEUGASTO_STORE_PASSWORD=...
MEUGASTO_KEY_ALIAS=...
MEUGASTO_KEY_PASSWORD=...
```

O diretório `~/.config/meugasto` deve ter permissão `0700`.

Para usar outro local, defina `MEUGASTO_RELEASE_ENV` antes do build. Não execute o script com `bash -x`: ele desabilita xtrace defensivamente, mas logs externos ainda podem expor variáveis de ambiente.

## Build

```bash
npm run android:build:release:local
```

O CI não usa esse arquivo local. Ele recebe o keystore e as credenciais exclusivamente por GitHub Actions Secrets.

## Token do Sentry

O token de autenticação do Sentry não é necessário para executar ou compilar o app. Guarde-o em `~/.config/meugasto/sentry.env` com permissão `0600` e carregue-o apenas no comando manual que publica source maps. Nunca mantenha `SENTRY_AUTH_TOKEN` em arquivos `.env` dentro do projeto.
