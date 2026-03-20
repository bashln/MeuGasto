# MeuGasto - Build Android

## Variáveis de Ambiente (.env)

**IMPORTANTE:** O arquivo `.env` é **OBRIGATÓRIO** para gerar o APK. Sem ele, a splash screen e a conexão com o Supabase não funcionarão corretamente.

## Árvore Android oficial

O diretório Android usado pelo projeto é:

```bash
mobile/android/
```

A pasta `android/` na raiz do repositório nao participa do build do app e deve ser tratada apenas como placeholder historico, quando existir.

### Arquivo `.env`

Crie o arquivo `mobile/.env` com base no `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Por que o .env é necessário?

1. **Splash Screen**: O Expo precisa das variáveis para configurar a conexão antes de renderizar a splash screen
2. **Supabase**: As credenciais são inlined no APK em tempo de build
3. **expo prebuild**: O prebuild precisa das variáveis para gerar o projeto Android em `mobile/android/` com os valores corretos

## ⚠️ Problema Comum: Splash Screen Trava

### Sintomas

- A splash screen fica branca ou travada infinitamente
- O app não consegue carregar após a splash screen
- Erro de conexão com Supabase mesmo tendo configurado o .env

### Causas Raiz Possiveis

Existem dois cenarios diferentes que parecem o mesmo sintoma:

1. **Variaveis de ambiente nao embedadas corretamente**
   - o `.env` nao estava presente ou nao foi carregado antes do `expo prebuild`
   - o diretorio `android/` foi gerado com valores antigos

2. **APK de debug instalado sem Metro rodando**
   - o app tenta carregar o bundle JS de `localhost:8081`
   - se o Metro nao estiver rodando, o React Native nao sobe
   - como o bootstrap JS nao inicia, a splash pode parecer travada

### Solucao

**SEMPRE use os scripts de build fornecidos** (`android-build-debug-device.sh` ou `android-build-release-local.sh`) - eles carregam o `.env` corretamente:

```bash
# O script usa "set -a" + "source .env" para exportar as variáveis
bash scripts/android-build-debug-device.sh
```

**SE O PROBLEMA PERSISTIR:** Remova o diretorio `android/` e rebuild:

```bash
cd mobile
rm -rf android
bash scripts/android-build-debug-device.sh
```

**NAO faca `expo prebuild` diretamente** sem usar o script:

```bash
# ISSO NÃO FUNCIONARÁ (variáveis não serão embedadas)
cd mobile
source .env
npx expo prebuild --platform android  # ❌ Variáveis não chegam ao Metro
```

## Builds Disponiveis

### Debug APK (desenvolvimento)

```bash
cd mobile
bash scripts/android-build-debug-device.sh
```

Este script:
1. Carrega as variaveis do `.env` (via `set -a` + `source`)
2. Executa `expo prebuild`
3. Compila o APK de debug

**Importante:** o APK de debug **nao e standalone**. Para abrir corretamente no dispositivo, voce precisa:

```bash
cd mobile
npm start
adb reverse tcp:8081 tcp:8081
```

Sem isso, o app pode abrir e ficar preso na splash porque nao conseguiu carregar o bundle JS do Metro.

Use debug APK apenas para desenvolvimento local com bundler ativo.

Fluxo recomendado:

```bash
cd mobile
bash scripts/android-build-debug-device.sh
bash scripts/android-start-debug-device.sh
npm run android:install:device:debug
```

O script de instalacao debug agora falha de forma intencional se:
- nao houver dispositivo adb conectado
- `adb reverse tcp:8081 tcp:8081` nao estiver ativo
- o Metro nao estiver rodando em `localhost:8081`

Isso evita instalar um APK debug em modo "standalone" por engano.

### Release APK (producao)

```bash
cd mobile
bash scripts/android-build-release-local.sh
```

Este script:
1. Valida todas as variaveis obrigatorias
2. Executa `expo prebuild --clean`
3. Compila o APK de release assinado

**Este e o formato correto para teste local standalone**, homologacao e distribuicao, porque o bundle JS vai embutido no APK e nao depende de Metro.

Se a intencao for instalar um APK no celular e testar sem computador, use sempre o build de release.

Fluxo recomendado:

```bash
cd mobile
bash scripts/android-build-release-local.sh
npm run android:install:release:local
```

Ou em um unico comando:

```bash
cd mobile
npm run android:test:release:local
```

Esse comando:
1. gera o APK release
2. instala no device conectado
3. abre o app automaticamente

O arquivo final sempre sera nomeado no formato:

```bash
MeuGastovX.X.X.apk
```

Exemplo:

```bash
MeuGastov1.3.1.apk
```

O script de release valida automaticamente:
- existencia do `.env`
- existencia da keystore
- geracao de `android/local.properties` para o SDK Android

## Escolha Correta do Tipo de Build

Use esta regra para nunca errar:

- `debug APK` -> desenvolvimento local, com `npm start` + `adb reverse`
- `release APK` -> teste real no aparelho, sem Metro, sem cabo, sem bundler

Se o objetivo for "gerar APK e instalar via adb para testar no celular", o mais correto e usar `release`.

## Regra Operacional

Para nunca mais ocorrer confusao com splash travada em APK local:

1. Nunca use `debug APK` para validacao standalone no aparelho
2. Use `debug` apenas com Metro ativo e `adb reverse`
3. Use `release` para qualquer teste local que precise funcionar sem computador
4. Se mudar `.env`, remova `android/` antes de gerar novamente
5. Sempre gere builds pelos scripts do projeto, nao por comandos soltos
6. Para release, prefira keystores em `~/.keystores/` com caminho absoluto no `.env`

## Resolucao de Problemas

### Splash screen branca ou travando

**Causas comuns:**
1. Variaveis de ambiente nao foram embedadas no bundle JS
2. Diretorio `android/` esta desatualizado
3. Voce instalou um APK de debug sem Metro rodando

**Solucao:**
1. Verifique se o arquivo `.env` existe em `mobile/.env`
2. Remova o diretorio `android/`: `rm -rf mobile/android`
3. Se for `debug`, rode tambem:
   ```bash
   cd mobile
   npm start
   adb reverse tcp:8081 tcp:8081
   ```
4. Recompile o APK usando o script de build:
   ```bash
   cd mobile
   bash scripts/android-build-debug-device.sh
   ```

5. Se quiser um APK independente, gere `release` em vez de `debug`

### Erro "Configuracao do Supabase ausente"

**Causa:** O APK foi compilado sem as variaveis do Supabase embedadas.

**Solucao:**
1. Remova o diretorio `android/`: `rm -rf mobile/android`
2. Recompile o APK usando o script de build
3. Confirme que `mobile/app.config.js` recebeu as variaveis do ambiente no momento do build

### Erro "Unable to load script" ou referencia ao Metro/8081

**Causa:** voce instalou um APK de debug sem o bundler rodando.

**Solucao:**

```bash
cd mobile
npm start
adb reverse tcp:8081 tcp:8081
```

Ou gere um APK de release:

```bash
cd mobile
bash scripts/android-build-release-local.sh
```

Se voce rodar `npm run android:install:device:debug`, o script ja vai bloquear a instalacao se Metro/reverse nao estiverem prontos.

### Se voce insiste em rodar `expo prebuild` manualmente

Se precisar rodar `expo prebuild` manualmente, carregue o `.env` corretamente:

```bash
cd mobile
set -a
source .env
set +a
npx expo prebuild --platform android
```

**Importante:** Sempre remova o diretorio `android/` antes de regenerar para garantir que as variaveis sejam embedadas corretamente.

---

## Assinatura do APK (Keystore)

### Debug

O build de debug usa uma keystore de debug automática. Não é necessária configuração adicional.

### Release

Para builds de release, você precisa de uma keystore válida. As keystores padrões ficam em `~/.keystores/`.

No arquivo `.env`, adicione:

```bash
MEUGASTO_STORE_FILE=~/.keystores/seu-arquivo.keystore
MEUGASTO_STORE_PASSWORD=sua-senha
MEUGASTO_KEY_ALIAS=seu-alias
MEUGASTO_KEY_PASSWORD=sua-senha-key
```
