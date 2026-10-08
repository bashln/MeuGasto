# Agent Rules: MeuGasto

## Fundamentos do projeto

Todo projeto deve resolver uma dor real antes de adicionar features.
Este documento define a identidade, propósito e direção do projeto.

### Problema

Consumidores brasileiros que fazem compras em supermercado não têm uma forma automatizada de registrar e acompanhar seus gastos. Aplicativos genéricos de controle financeiro não integram com o sistema fiscal brasileiro (NFC-e). Digitar dados manualmente de dezenas de itens é tedioso e inviabiliza o hábito.

### Impacto

Visibilidade real sobre gastos em supermercado com zero esforço manual. Ao escanear o QR Code da nota fiscal, a compra completa é registrada automaticamente, incluindo itens, quantidades, preços, estabelecimento e data.

### Missão

Transformar o registro de compras em um hábito automático que gera consciência financeira real.

### Core feature

Leitura automatizada de NFC-e (Nota Fiscal de Consumidor Eletrônica) via QR Code com extração completa dos dados da compra.

### Diferencial

Integração nativa com o sistema brasileiro de NFC-e com suporte progressivo a todos os estados, scraping direto de portais SEFAZ e extração sem digitação manual. Privacidade como princípio arquitetural, com k-anonymity e tabelas de analytics sem identificação de usuário.

### Filosofia

- Privacidade por design: nem nós sabemos quanto você gasta, apenas você.
- Automação real: o aplicativo faz o trabalho pesado, não o usuário.
- Dados do usuário pertencem ao usuário.
- Simplicidade acima de quantidade de features.
- Transparência com código aberto (GNU AGPLv3).

### Público

Consumidores brasileiros que fazem compras em supermercados e querem controle de gastos sem esforço manual.
Não é foco: empresas, contadores, grandes redes de varejo ou pessoas fora do Brasil.

### Restrições

O projeto nunca deve se tornar:

- Um aplicativo que coleta e vende dados de consumo dos usuários
- Um aplicativo que exige cadastro empresarial ou CNPJ
- Uma plataforma dependente de lojas proprietárias para distribuição
- Um aplicativo lotado de recursos irrelevantes que diluem o propósito central
- Um serviço onde administradores possam inspecionar dados individuais de usuários

---

## Versionamento

Formato: `vMAJOR.MINOR.PATCH.BUILD`

| Segmento | Quando incrementar |
| :--- | :--- |
| **MAJOR** | Mudanças grandes de arquitetura, identidade ou compatibilidade. Requer aprovação explícita. |
| **MINOR** | Novas funcionalidades e capacidades relevantes. |
| **PATCH** | Correções, refinamentos e melhorias pequenas. |
| **BUILD** | Alterações internas, builds técnicas e ajustes sem impacto funcional direto. |

Regra: quando um segmento sobe, todos os segmentos à direita retornam a zero.
Exemplo: `v0.4.1.0`

## Invariantes

### Assinatura Android e pacote

- O identificador `com.prati.meugasto` em `mobile/app/build.gradle.kts` e `mobile/app.json` nunca deve mudar.
- Segredos de keystore (`ANDROID_KEYSTORE_*`) não devem ser rotacionados sem plano de release.

### Códigos de versão

- `versionCode` no Android deve sempre incrementar, nunca decrementar ou ser reutilizado.
- Mantenha `versionName` e `versionCode` sincronizados entre `mobile/app/build.gradle.kts` e `mobile/app.json`.

### Permissão de microfone

- A permissão `RECORD_AUDIO` é proibida no aplicativo. Apenas `CAMERA` é permitida para leitura de QR Code.

## Regras de branches

- A branch `main` é protegida. Nunca realize push direto ou force push em `main`.
- Todas as alterações passam por `dev`, pull request e então `main`.

## Modelo de distribuição

- Android: APK assinado via GitHub Releases acionado pela tag `v*` em `release.yml`.
- Os artefatos de release seguem o padrão `meugastovX.X.X.XX.apk`.
- Atualizações: o gerenciador `InAppUpdateManager` consulta `https://api.github.com/repos/bashln/MeuGasto/releases/latest` e oferece download e instalação do novo APK via FileProvider do Android.
- As tags de release no GitHub devem seguir estritamente o formato `vX.Y.Z.W`.

## Progresso de implementação de notas fiscais

- [ ] Acre
- [ ] Alagoas
- [ ] Amapá
- [ ] Amazonas
- [ ] Bahia
- [ ] Ceará
- [ ] Distrito Federal
- [ ] Espírito Santo
- [ ] Goiás
- [ ] Maranhão
- [ ] Mato Grosso
- [ ] Mato Grosso do Sul
- [ ] Minas Gerais
- [ ] Pará
- [ ] Paraíba
- [ ] Paraná
- [ ] Pernambuco
- [ ] Piauí
- [ ] Rio de Janeiro
- [ ] Rio Grande do Norte
- [x] Rio Grande do Sul
- [ ] Rondônia
- [ ] Roraima
- [ ] Santa Catarina
- [ ] São Paulo
- [ ] Sergipe
- [ ] Tocantins
