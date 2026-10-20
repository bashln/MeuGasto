# MeuGasto

Aplicativo Android nativo para controle de compras e gastos em supermercados, farmácias e postos.

O aplicativo registra compras automaticamente através da leitura do QR Code da NFC-e (Nota Fiscal de Consumidor Eletrônica), extraindo itens, quantidades, valores e dados do estabelecimento.

## Download

Baixe a versão mais recente diretamente na seção de [Releases](https://github.com/bashln/MeuGasto/releases).

Os arquivos APK assinados são gerados automaticamente pelo GitHub Actions para tags no formato `vX.Y.Z.W`.

## Tecnologia

- **Linguagem e interface:** Kotlin 2.x com Jetpack Compose e Material 3
- **Banco de dados local:** Room Database (SQLite)
- **Câmera e visão:** CameraX e Google ML Kit Barcode Scanning
- **Comunicação de rede:** Ktor Client com OkHttp
- **Armazenamento e sincronização:**
  - Modo Local-First: dados armazenados exclusivamente no dispositivo, com suporte a backup pessoal via WebDAV.
  - Modo Nuvem: sincronização com Supabase (PostgreSQL com Row Level Security).
- **Compilação e automação:** Gradle 8.9 e GitHub Actions

## Estrutura do projeto

```
.
├── docs/                      # Documentação técnica, arquitetura e ADRs
├── mobile/                    # Projeto Android nativo
│   ├── app/
│   │   ├── src/main/kotlin/   # Código-fonte da aplicação
│   │   └── src/test/kotlin/   # Testes unitários
│   ├── gradle/                # Version catalog e wrapper do Gradle
│   └── build.gradle.kts       # Configuração de build do projeto
├── scripts/                   # Scripts de validação, segurança e CI
└── supabase/                  # Migrações e testes de segurança do banco
```

## Desenvolvimento

Para compilar e testar o aplicativo, utilize o Android SDK com Java 17.

Navegue até a pasta `mobile`:

```bash
cd mobile
```

Executar os testes unitários:

```bash
./gradlew test
```

Gerar o APK de depuração:

```bash
./gradlew assembleDebug
```

Instalar diretamente em um dispositivo conectado via USB ou emulador:

```bash
./gradlew installDebug
```

Gerar o APK de release assinado localmente:

```bash
export MEUGASTO_STORE_FILE=/caminho/para/meugasto-release.jks
export MEUGASTO_STORE_PASSWORD=senha
export MEUGASTO_KEY_ALIAS=alias
export MEUGASTO_KEY_PASSWORD=senha
./gradlew assembleRelease
```

O arquivo gerado fica em `mobile/app/build/outputs/apk/release/app-release.apk`.

## Variáveis de ambiente

As variáveis de conexão com o Supabase podem ser passadas pelo ambiente ou por um arquivo `.env` na pasta `mobile/`:

```
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima
```

No Android nativo, essas variáveis são incorporadas na classe `BuildConfig` durante a compilação.

## Leitura de NFC-e

A captura ocorre pelo leitor CameraX integrado ao ML Kit. A URL do QR Code é direcionada para o `NfceScraperEngine`, que seleciona a estratégia estadual correspondente (por exemplo, `RsNfceStrategy` ou `RjNfceStrategy`) e extrai os itens da compra diretamente do portal da SEFAZ.

## Licença

Este projeto é distribuído sob a licença GNU AGPLv3. Veja o arquivo `LICENSE` para detalhes completos.
