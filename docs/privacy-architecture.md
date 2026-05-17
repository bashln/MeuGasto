# Arquitetura de Privacidade do MeuGasto

## Principio obrigatorio

O MeuGasto deve ser desenhado assumindo que ate uma pessoa com acesso administrativo normal pode ser curiosa ou mal-intencionada.

O administrador deve enxergar o preco dos itens, nao a vida financeira das pessoas.

Isso significa que o produto nunca deve permitir que uma visao administrativa comum revele, exporte ou facilite inferir:

- quanto uma pessoa especifica gastou;
- onde ela comprou;
- o que ela comprou;
- frequencia individual de compras;
- padrao de vida, renda provavel, dividas ou contas fixas;
- comparacao financeira entre usuarios, colegas ou amigos.

O diferencial de confianca do produto deve ser verdadeiro por arquitetura:

> Nem nos sabemos quanto voce gasta. So voce.

## Threat Model

Ator principal de risco: administrador curioso ou mal-intencionado com acesso operacional ao painel, logs, consultas de suporte ou relatorios internos.

Riscos proibidos:

- listar compras de um usuario especifico;
- cruzar email, nome, telefone ou conta com compras, itens, mercados ou totais;
- consultar gasto total por usuario;
- comparar dois usuarios;
- exportar dados brutos individualizados;
- usar datas, mercados raros, itens sensiveis ou baixa cardinalidade para reidentificar uma pessoa.

Controles obrigatorios:

- administracao comum acessa apenas agregados;
- tabelas analiticas nao contem `user_id`, email, nome, token de sessao ou chave fiscal completa;
- consultas sensiveis sao bloqueadas por permissao e auditadas;
- acesso excepcional a dados brutos exige break-glass, justificativa, aprovacao, prazo curto e auditoria.

## Separacao de Dominios

Separar tres necessidades que hoje parecem parecidas, mas tem riscos diferentes:

```txt
Identidade      -> login, conta, consentimento, suporte
Compras pessoais -> historico privado do proprio usuario
Analytics       -> inteligencia coletiva de precos e mercados
```

O app pode manter historico individual para a experiencia do proprio usuario, desde que esse vinculo nao seja exposto ao administrador comum nem reutilizado em analytics administrativos.

## Modelo Operacional

As tabelas operacionais continuam existindo para o aplicativo:

```txt
auth.users
profiles
purchases(user_id, supermarket_id, date, total_price, ...)
items(purchase_id, name, quantity, price, ...)
drafts(user_id, ...)
```

Regras:

- RLS permite ao usuario ler e alterar apenas seus proprios dados.
- Funcoes de relatorio individual usam `auth.uid()` e retornam apenas dados do proprio usuario.
- Nenhuma tela administrativa comum consulta `purchases`, `items`, `drafts` ou `profiles` diretamente.
- `service_role` nao deve ser usado por paineis administrativos comuns.

## Modelo Analitico

O analytics deve ser materializado em tabelas separadas, sem identificador de usuario.

Exemplo de tabelas-alvo:

```sql
analytics_item_prices (
  bucket_date date not null,
  city text,
  state text,
  supermarket_id integer,
  normalized_item_name text not null,
  unit text,
  avg_unit_price numeric not null,
  min_unit_price numeric not null,
  max_unit_price numeric not null,
  sample_count integer not null,
  contributor_count integer not null,
  created_at timestamptz not null default now()
);

analytics_market_baskets (
  bucket_date date not null,
  city text,
  state text,
  supermarket_id integer,
  basket_key text not null,
  avg_basket_price numeric not null,
  min_basket_price numeric not null,
  max_basket_price numeric not null,
  sample_count integer not null,
  contributor_count integer not null,
  created_at timestamptz not null default now()
);

analytics_price_trends (
  bucket_month date not null,
  city text,
  state text,
  normalized_item_name text not null,
  avg_price numeric not null,
  price_change_percent numeric,
  sample_count integer not null,
  contributor_count integer not null,
  created_at timestamptz not null default now()
);
```

Proibido nas tabelas analiticas:

- `user_id`;
- email, nome, telefone ou identificador de conta;
- `purchase_id` operacional;
- chave NFC-e completa;
- timestamp preciso quando dia/semana/mes for suficiente;
- qualquer token estavel por usuario.

## Pipeline de Agregacao

Fluxo recomendado:

```txt
1. Usuario salva compra no cofre operacional privado.
2. Job interno le somente o necessario para analytics.
3. Job normaliza item, unidade, mercado, cidade e periodo.
4. Job grava somente agregados com limite minimo de contribuidores.
5. Dados temporarios do job sao descartados.
6. Admin consulta somente tabelas ou views analiticas.
```

Regras de seguranca:

- usar janela temporal agregada, como dia, semana ou mes;
- publicar agregado somente se `contributor_count >= k`;
- usar `k >= 5` como minimo operacional inicial e aumentar para regioes pequenas ou itens sensiveis;
- suprimir ou arredondar resultados de baixa cardinalidade;
- limitar detalhamento simultaneo por cidade, mercado, data e item quando o conjunto ficar pequeno;
- nao permitir drill-down ate compra individual.

## Retencao Minima

Dados brutos individualizados devem existir pelo menor tempo necessario para a finalidade do usuario.

Recomendacao:

- historico pessoal: mantido enquanto o usuario quiser usar a funcionalidade;
- rascunhos: expirar ou arquivar depois de periodo curto configuravel;
- chaves fiscais completas: evitar armazenar; se necessario, criptografar e reter pelo menor prazo util;
- logs: nunca registrar item comprado, total de compra, email junto de evento financeiro ou payload NFC-e completo;
- exports internos: proibidos para dados brutos individualizados.

Para analytics, reter apenas agregados.

## Criptografia Recomendada

Para seguranca fiscal e privacidade, usar uma combinacao de criptografia, nao uma tecnica unica.

1. Criptografia em transito: TLS obrigatorio.
2. Criptografia em repouso: recursos nativos do provedor de banco e storage.
3. Criptografia de campo para PII: email, telefone, nome, documentos e chaves fiscais sensiveis devem usar envelope encryption.
4. Hash/HMAC para deduplicacao: quando for necessario comparar uma chave fiscal sem revela-la, armazenar `HMAC-SHA-256(chave_fiscal, secret_do_servidor)` e nao a chave em texto puro.
5. Criptografia no cliente ou por chave do usuario para historico pessoal sensivel: ideal para cumprir a promessa "nem nos sabemos", porque o servidor guarda ciphertext e nao consegue ler o conteudo sem a chave do usuario.

Escolha pratica:

- PII administrativa: envelope encryption com KMS ou secret gerenciado fora do banco.
- Chave NFC-e para deduplicacao: HMAC-SHA-256.
- Historico pessoal de compras, se a promessa comercial for forte: criptografia de campo client-side com AES-256-GCM ou XChaCha20-Poly1305, com chaves derivadas/protegidas por credenciais do usuario ou cofre seguro.

Importante: criptografia nao substitui separacao de dados. Se o admin tiver acesso normal a uma tabela que junta `user_id`, item, mercado e total, a arquitetura ja falhou mesmo que alguns campos estejam criptografados.

## Acesso Administrativo

O painel administrativo deve oferecer somente:

- preco medio por item, mercado, cidade e periodo;
- menor e maior preco observado em agregados;
- ranking de mercados por cesta media;
- tendencias de inflacao percebida;
- qualidade de dados agregada;
- volume agregado de contribuicoes.

O painel nao deve oferecer:

- busca por usuario;
- lista de compras de usuario;
- gasto total por usuario;
- comparacao entre usuarios;
- exportacao de compras brutas;
- filtros que possam isolar uma pessoa.

Consultas sensiveis devem gerar auditoria com:

- quem consultou;
- quando consultou;
- qual finalidade informada;
- qual objeto acessou;
- quantas linhas retornou;
- aprovador, quando houver break-glass.

## Prevencao Contra Reidentificacao

Mesmo sem `user_id`, um agregado pode expor alguem se for pequeno demais.

Controles:

- k-anonymity por agregado com `contributor_count` minimo;
- bucketizacao de data e localidade;
- supressao de combinacoes raras;
- arredondamento de valores para relatorios publicos;
- limites contra filtros muito especificos;
- revisao manual antes de publicar rankings em cidades, empresas ou grupos pequenos;
- nao exibir itens sensiveis em cortes pequenos.

## LGPD e Privacy by Design

Bases e principios:

- finalidade: dados pessoais existem para entregar historico e controle ao usuario;
- necessidade/minimizacao: analytics usa somente agregados sem identidade;
- transparencia: explicar claramente o que e privado e o que vira estatistica;
- seguranca: criptografia, RLS, segregacao de roles, auditoria e retencao minima;
- prevencao: bloquear desenho de produto que permita vigilancia;
- livre acesso: permitir que o usuario veja, exporte e exclua seus proprios dados.

O usuario deve poder:

- ver seu proprio historico;
- apagar compras;
- excluir conta;
- entender quais dados sao usados para inteligencia coletiva;
- optar por nao contribuir para analytics, se essa for a politica comercial adotada.

## Estado Atual e Gap Arquitetural

O schema atual do MeuGasto usa `purchases.user_id` e `items.purchase_id`, com RLS por usuario. Isso e adequado para o app individual.

O gap e que ainda nao existe uma camada analitica separada sem `user_id`. Portanto:

- nao criar painel administrativo sobre `purchases` e `items`;
- nao conceder acesso SQL comum a essas tabelas para administradores;
- criar views/tabelas analiticas antes de qualquer funcionalidade administrativa;
- tratar qualquer exportacao bruta como incidente de privacidade, salvo fluxo break-glass auditado.

## Mensagem Comercial

Texto recomendado:

> O MeuGasto foi criado para comparar precos, nao pessoas. Seu historico financeiro e privado: voce ve suas compras; administradores veem apenas estatisticas agregadas de precos. Nem mesmo uma pessoa com acesso administrativo comum consegue usar o sistema para descobrir quanto voce gasta, onde compra ou comparar sua vida financeira com a de outra pessoa.

Versao curta:

> Nem nos sabemos quanto voce gasta. So voce.

## Criterios de Aceite Arquitetural

- Nenhuma tabela analitica contem `user_id`.
- Nenhuma tela administrativa consulta compras brutas.
- Relatorios administrativos aplicam limite minimo de contribuidores.
- Logs nao registram payload financeiro individualizado.
- Dados fiscais sensiveis nao ficam em texto puro.
- Acesso excepcional a dados brutos e auditado e temporario.
- Testes ou revisoes de schema bloqueiam introducao de `user_id` em tabelas analiticas.

## Plano de Implementacao

O plano executavel esta em [Plano de Implementacao de Privacidade](privacy-implementation-plan.md).
