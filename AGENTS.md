# MeuGasto — Guia do Projeto

## Fundamentos do Projeto

**Todo projeto deve resolver uma dor real antes de adicionar features.
Este documento define a identidade, propósito e direção do projeto.**

### Problema

Brasileiros que fazem compras em supermercado não têm uma forma automatizada de registrar e acompanhar seus gastos. Apps genéricos de controle financeiro não integram com o sistema fiscal brasileiro (NFC-e). Extrair dados manualmente de 30+ itens é tedioso — ninguém mantém o hábito.

### Impacto

Visibilidade real sobre gastos em supermercado com **zero esforço manual**. Escaneia o QR Code da nota fiscal → compra completa registrada automaticamente: itens, quantidades, preços, supermercado, data.

### Missão

Transformar o tédio de registrar compras em um hábito automático que gera consciência financeira real.

### Core Feature

Leitura automatizada de NFC-e (Nota Fiscal de Consumidor Eletrônica) via QR Code com extração completa dos dados da compra.

### Diferencial

Integração nativa com o sistema brasileiro de NFC-e — suporte a todos os 27 estados, scraping de portais SEFAZ + API externa como fallback, extração automática sem digitação manual. Privacidade como princípio arquitetural: admin não vê dados individuais (k-anonymity, tabelas de analytics sem `user_id`).

### Filosofia

- **Privacidade por design** — "Nem nós sabemos quanto você gasta. Só você."
- **Automação real** — o app faz o trabalho pesado, não o usuário
- **Dados do usuário pertencem ao usuário**
- **Simplicidade** > quantidade de features
- **Transparência** — código aberto (GNU AGPLv3), sem surpresas

### Público

Consumidores brasileiros que fazem compras em supermercados e querem controle de gastos sem esforço manual.

**Não é foco:** empresas, contadores, grandes redes de varejo, pessoas fora do Brasil.

### Restrições

O projeto nunca deve se tornar:
- Um app que coleta e vende dados de consumo dos usuários
- Um app que exige cadastro empresarial ou CNPJ
- Uma plataforma dependente de Play Store / App Store para distribuição
- Um app lotado de features irrelevantes que diluem o propósito central
- Um SaaS onde o provedor pode espiar dados individuais dos usuários

---

## Versionamento

Formato: `vMAJOR.MINOR.PATCH.BUILD`

| Segmento | Quando incrementar |
|---|---|
| **MAJOR** | Mudanças grandes de arquitetura, identidade ou compatibilidade. Deve ser usado apenas após período de alpha/beta. Requer aprovação explícita do desenvolvedor responsável. |
| **MINOR** | Novas funcionalidades e capacidades relevantes. |
| **PATCH** | Correções, refinamentos e melhorias pequenas. |
| **BUILD** | Alterações internas, builds técnicas e ajustes sem impacto funcional direto. |

**Regra:** Quando um segmento sobe, todos os segmentos à direita retornam a zero.

**Exemplo:** `v1.4.2.15`

---

## Invariantes (NEVER change without explicit user confirmation)

### EAS Project ID

- `mobile/app.json` → `extra.eas.projectId` is permanently tied to installed APKs
- **Never modify this value.** Changing it breaks OTA updates for all existing installs
- Users must reinstall the APK manually to recover — there is no automatic fallback
- If EAS project migration is truly needed, flag it explicitly and warn the user before touching this field

### Android signing

- `mobile/app.json` → `android.package` (`com.prati.meugasto`) must never change after first install
- Keystore secrets (`ANDROID_KEYSTORE_*`) must never be rotated without a full release plan

### Version codes

- `android.versionCode` and `ios.buildNumber` must always increment — never decrement or reuse
- Keep in sync with `version` in `app.json`

---

## Branch rules

- `main` branch is protected — never push directly, never force push
- All changes go through `dev` -> PR -> `testing` → PR → `main`
- `dev` é onde tudo o que está sendo construido ocorre, aqui é onde eu testo tudo.
- `testing` é onde os usuários da base de testes realizam os testes por aproximadamente 1 mês.
- `main` é o que recebe o conteúdo de `testing` após ~1 mês de testes bem sucedidos.

---

## Distribution model

- Android: signed APK via GitHub Releases (tag `v*` triggers `release.yml`)
- OTA updates: EAS Update via `ota-update.yml` (dev → preview channel, main → production channel)
- No Google Play, no TestFlight
