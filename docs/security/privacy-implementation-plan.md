# Plano Executavel de Privacidade do MeuGasto

## Objetivo

Criar um modelo onde uma pessoa com acesso administrativo normal nao consiga usar o MeuGasto para vigiar, comparar ou expor a vida financeira de usuarios.

Resultado esperado:

- usuario ve seu proprio historico;
- admin ve apenas inteligencia coletiva de precos;
- analytics nao contem `user_id`;
- dados fiscais e pessoais sensiveis nao ficam expostos em texto puro;
- qualquer acesso excepcional a dado bruto e raro, justificado, temporario e auditado.

## Fase 0 - Congelar Risco Administrativo

Antes de criar qualquer painel administrativo, suporte interno ou exportacao:

1. Proibir acesso administrativo comum as tabelas `purchases`, `items`, `drafts`, `profiles` e `auth.users`.
2. Proibir uso de `service_role` em frontend, painel admin comum ou automacao sem escopo.
3. Documentar que `purchases.user_id` existe somente para experiencia privada do usuario.
4. Tratar exportacao bruta de compras como incidente de privacidade, salvo break-glass auditado.

Criterios de aceite:

- nenhum endpoint admin retorna compra individual;
- nenhum relatorio admin aceita filtro por usuario;
- nenhuma rotina admin exporta `user_id`, email, compra ou item bruto.

Down sides:

- suporte fica menos conveniente, porque nao pode simplesmente "abrir a conta" e olhar compras;
- diagnostico de bugs com dados reais exige mais disciplina e logs anonimizados;
- algumas tarefas operacionais vao precisar de ferramentas especificas em vez de SQL livre.

## Fase 1 - Classificar Dados e Permissoes

Criar um inventario simples de dados por tabela.

Classificacao recomendada:

| Area | Tabelas | Sensibilidade | Admin comum |
| --- | --- | --- | --- |
| Identidade | `auth.users`, `profiles` | alta | nao ve dados pessoais brutos |
| Historico pessoal | `purchases`, `items`, `drafts` | muito alta | sem acesso |
| Preferencias pessoais | `learned_reclassifications` | media/alta | sem acesso |
| Catalogo compartilhado | supermercados publicos/categorias | media | leitura limitada |
| Analytics | futuras `analytics_*` | baixa/media | leitura permitida com agregacao |

Tarefas:

1. Criar documento ou comentario de schema marcando tabelas sensiveis.
2. Definir roles de banco:
   - `app_user`: acesso via RLS;
   - `analytics_reader`: apenas views/tabelas agregadas;
   - `support_limited`: metadados minimos, sem compras;
   - `break_glass`: acesso excepcional, temporario e auditado.
3. Revisar qualquer uso futuro de `profiles.role` para nao virar permissao ampla.

Criterios de aceite:

- cada tabela tem dono, finalidade e nivel de sensibilidade;
- admin comum nao herda permissao de leitura em tabelas operacionais;
- `analytics_reader` nao consegue consultar `purchases` nem `items`.

Down sides:

- mais roles aumentam complexidade operacional;
- permissoes mal configuradas podem quebrar funcoes existentes;
- exige processo de revisao quando novas tabelas forem criadas.

## Fase 2 - Criar Camada Analitica Sem Identidade

Criar tabelas ou materialized views separadas para inteligencia coletiva.

Tabelas iniciais:

```sql
analytics_item_prices
analytics_market_baskets
analytics_price_trends
analytics_data_quality
```

Regras:

- nunca incluir `user_id`;
- nunca incluir email, nome, telefone ou token de conta;
- nunca incluir `purchase_id` operacional;
- nunca incluir chave NFC-e completa;
- usar periodo agregado: dia, semana ou mes;
- usar cidade/estado/mercado apenas quando houver amostra suficiente;
- exigir `contributor_count >= 5` no minimo.

Tarefas:

1. Criar migration SQL para tabelas `analytics_*`.
2. Criar indices para filtros por item, mercado, cidade, estado e periodo.
3. Criar policies permitindo leitura para role administrativa analitica.
4. Bloquear escrita direta por usuarios e admin comum.

Criterios de aceite:

- `analytics_*` nao tem colunas de identidade;
- consultas admin rodam somente nessas tabelas/views;
- agregados pequenos ficam ausentes ou suprimidos.

Down sides:

- analytics deixa de ser em tempo real se depender de job;
- agregados com poucos usuarios somem, reduzindo utilidade em cidades pequenas;
- sem `user_id`, fica mais dificil corrigir retroativamente dados de um usuario especifico dentro do analytics.

## Fase 3 - Pipeline de Agregacao

Implementar um job interno que transforma compras brutas em agregados.

Fluxo:

```txt
purchases/items privados
  -> job com permissao controlada
  -> normalizacao de item/unidade/mercado/periodo
  -> agregacao com k-anonymity
  -> escrita em analytics_*
  -> descarte de dados temporarios
```

Tarefas:

1. Definir periodicidade inicial: diario.
2. Normalizar nomes de itens para reduzir ruido.
3. Calcular preco unitario quando possivel.
4. Agrupar por periodo, item, mercado e localidade.
5. Calcular:
   - `avg_price`;
   - `min_price`;
   - `max_price`;
   - `sample_count`;
   - `contributor_count`.
6. Publicar somente grupos com contribuidores suficientes.
7. Garantir que tabelas temporarias sejam apagadas ao final.

Criterios de aceite:

- job nao grava identificadores de usuario em analytics;
- grupos abaixo do minimo nao sao publicados;
- falhas do job nao imprimem payload financeiro sensivel em logs.

Down sides:

- job adiciona manutencao e monitoramento;
- bugs de normalizacao podem distorcer precos;
- agregacao diaria pode atrasar insights.

## Fase 4 - Criptografia e Segredos

Aplicar criptografia conforme finalidade.

Recomendacao:

| Dado | Tecnica | Motivo |
| --- | --- | --- |
| email/nome/telefone | envelope encryption | PII reversivel quando estritamente necessario |
| chave NFC-e para dedupe | HMAC-SHA-256 | comparar sem revelar |
| chave NFC-e completa | evitar armazenar; se necessario, criptografar | dado fiscal sensivel |
| historico pessoal forte | client-side encryption | servidor/admin nao le conteudo |
| banco/storage | encryption at rest | protecao basica de infraestrutura |
| trafego | TLS | protecao em transito |

Tarefas:

1. Substituir armazenamento de chave NFC-e completa por hash HMAC para deduplicacao, quando possivel.
2. Se a chave completa for indispensavel, armazenar ciphertext e prazo de retencao.
3. Definir onde ficam secrets/KMS; nunca dentro do banco junto dos dados.
4. Avaliar client-side encryption para compras e itens se a promessa comercial for "nem nos sabemos".

Criterios de aceite:

- dado fiscal sensivel nao fica em texto puro sem justificativa;
- segredo de HMAC nao esta no app mobile;
- admin de banco nao consegue deduzir chave fiscal a partir do hash.

Down sides:

- client-side encryption reduz capacidade de busca, suporte, recuperacao e analytics direto;
- perda de chave pelo usuario pode significar perda real de acesso ao historico;
- KMS/secret management aumenta custo e complexidade;
- HMAC impede leitura da chave original, entao fluxos que precisam da chave completa devem ser redesenhados.

## Fase 5 - Funcionalidades do Usuario Sem Expor ao Admin

Manter as funcionalidades privadas no contexto do proprio usuario.

Permitido:

- dashboard pessoal;
- historico de compras;
- relatorios individuais;
- edicao/exclusao de compras;
- exportacao pessoal solicitada pelo proprio usuario.

Regras:

- todas as consultas individuais usam `auth.uid()`;
- nenhuma funcao `SECURITY DEFINER` deve retornar dados de outro usuario;
- exportacao pessoal exige sessao do proprio usuario;
- suporte nao executa exportacao em nome do usuario sem fluxo formal.

Criterios de aceite:

- usuario continua usando o app normalmente;
- admin nao consegue abrir a mesma tela com outro `user_id`;
- testes cobrem tentativa de acesso cruzado.

Down sides:

- suporte humano fica limitado;
- alguns bugs vao depender de reproducao pelo usuario ou logs tecnicos anonimizados;
- funcionalidades de "conta familiar" ou compartilhamento precisam de consentimento e modelagem propria.

## Fase 6 - Admin Somente Por Agregados

Construir painel administrativo apenas sobre `analytics_*`.

Permitido:

- preco medio do arroz por mercado;
- variacao por cidade;
- menor e maior preco agregado;
- ranking de mercados por cesta media;
- tendencia de inflacao percebida;
- qualidade de dados agregada.

Proibido:

- busca por usuario;
- gasto total por usuario;
- historico individual;
- lista de compras por pessoa;
- filtros que isolem uma pessoa;
- exportacao de dados brutos.

Tarefas:

1. Criar endpoints administrativos que leem apenas `analytics_*`.
2. Aplicar limites de cardinalidade no backend, nao apenas no frontend.
3. Adicionar auditoria para consultas administrativas.
4. Bloquear CSV bruto; permitir exportacao somente agregada.

Criterios de aceite:

- endpoint admin nao importa services de compra individual;
- nenhum payload admin contem `user_id`, `purchase_id` ou email;
- filtros muito especificos retornam erro ou agregado suprimido.

Down sides:

- produto admin fica menos flexivel;
- usuarios internos podem pedir "so uma consulta rapida" e isso deve ser negado;
- algumas analises legitimas ficam indisponiveis sem processo controlado.

## Fase 7 - Auditoria e Break-Glass

Criar processo para acesso excepcional.

Break-glass deve exigir:

- motivo;
- pessoa solicitante;
- aprovador;
- prazo curto;
- escopo minimo;
- log imutavel;
- revisao posterior.

Tarefas:

1. Criar tabela `sensitive_access_audit`.
2. Registrar acessos excepcionais e consultas sensiveis.
3. Criar alertas para consultas fora do padrao.
4. Revisar periodicamente acessos.

Criterios de aceite:

- nao existe acesso bruto silencioso;
- auditoria mostra quem acessou, quando, por que e quantas linhas;
- credenciais temporarias expiram.

Down sides:

- processo pode atrasar investigacoes urgentes;
- auditoria precisa ser protegida contra alteracao;
- exige maturidade operacional.

## Fase 8 - Retencao, Exclusao e LGPD

Definir politica de vida dos dados.

Tarefas:

1. Permitir exclusao de conta e compras do usuario.
2. Definir expiracao para rascunhos antigos.
3. Remover ou criptografar chaves fiscais completas.
4. Manter analytics agregado sem identidade, quando legalmente adequado.
5. Documentar finalidade e uso de dados em politica de privacidade.

Criterios de aceite:

- usuario consegue apagar seus dados pessoais;
- logs nao impedem exclusao efetiva;
- analytics restante nao permite reidentificacao razoavel.

Down sides:

- exclusao reduz capacidade de recalcular historico analitico;
- requisitos fiscais podem exigir retencao especifica se o produto assumir papel fiscal;
- politica de privacidade precisa acompanhar a implementacao real.

## Fase 9 - Testes e Guardrails

Criar testes e checagens contra regressao de privacidade.

Tarefas:

1. Testar RLS: usuario A nao le usuario B.
2. Testar que roles admin nao leem `purchases` e `items`.
3. Testar que `analytics_*` nao tem `user_id`.
4. Testar k-anonymity em agregados pequenos.
5. Adicionar checagem simples em CI para impedir `user_id` em tabelas `analytics_*`.
6. Revisar logs para nao conter payload financeiro individualizado.

Criterios de aceite:

- suite falha se tabela analitica ganhar `user_id`;
- suite falha se admin comum conseguir ler compra bruta;
- suite falha se agregado pequeno for publicado.

Down sides:

- testes de permissao em Supabase/Postgres demandam ambiente de banco confiavel;
- CI fica mais pesado;
- guardrails podem bloquear migrations legitimas ate serem justificadas.

## Sequencia Recomendada

1. Fase 0: congelar risco antes de qualquer admin.
2. Fase 1: classificar dados e roles.
3. Fase 2: criar `analytics_*`.
4. Fase 3: implementar pipeline de agregacao.
5. Fase 6: criar painel/admin API somente agregada.
6. Fase 9: adicionar guardrails automatizados.
7. Fase 4: fortalecer criptografia, priorizando NFC-e/PII.
8. Fase 8: completar retencao, exclusao e LGPD.
9. Fase 7: implementar break-glass antes de qualquer operacao com time maior.

## Primeira Entrega Tecnica Recomendada

Escopo pequeno e seguro:

1. Adicionar migration com tabelas `analytics_item_prices` e `analytics_market_baskets`.
2. Criar uma funcao/job de agregacao diario.
3. Garantir `contributor_count >= 5`.
4. Criar uma view/admin query que le somente essas tabelas.
5. Adicionar teste/checagem que falha se `analytics_*` tiver `user_id`.

Isso entrega valor de negocio sem abrir uma porta administrativa para historico individual.
