# ADR 0001 — Criptografia ponta a ponta e administração sem acesso aos gastos

- Status: proposta
- Data: 2026-07-18
- Escopo: compras, itens, rascunhos, listas e comparações

## Contexto

RLS impede que um usuário leia os dados de outro, mas administradores do banco e
credenciais privilegiadas ainda conseguem acessar valores individuais. Isso não
cumpre literalmente a promessa “Nem nós sabemos quanto você gasta. Só você.”.

Criptografar somente a chave da NFC-e também é insuficiente: supermercado, itens,
quantidades, preços, totais e datas permitem reconstruir os hábitos de consumo.
Ao mesmo tempo, criptografar esses campos remove a capacidade do Postgres de fazer
busca, comparação e relatórios sobre os dados individuais.

## Decisão proposta

Adotar um modelo de documento criptografado no cliente, por usuário, no qual o
servidor armazena somente ciphertext autenticado e metadados operacionais mínimos.
Nenhuma chave capaz de descriptografar gastos será enviada ao Supabase, aos
administradores ou aos serviços de analytics.

### Modelo de chaves

1. O app gera localmente uma chave de dados aleatória de 256 bits (DEK) por usuário.
2. A DEK é guardada no armazenamento seguro do dispositivo e envolvida por uma
   chave de recuperação derivada de um segredo de alta entropia controlado pelo
   usuário. O backend guarda apenas a DEK envolvida.
3. Um novo dispositivo recebe a chave por pareamento via QR Code ou pela chave de
   recuperação. Não haverá escrow do provedor: perder ambos significa perder o
   acesso aos dados criptografados.
4. A rotação cria uma nova versão de DEK e recriptografa documentos no cliente de
   forma retomável. Ciphertexts carregam `key_version` e `schema_version`.

Usar uma biblioteca criptográfica auditada com AEAD, preferencialmente
XChaCha20-Poly1305. O associated data deve vincular ciphertext a usuário, tipo de
documento, identificador, versão do schema e versão da chave, impedindo troca de
blocos entre registros. Parâmetros e nonces nunca serão implementados manualmente.

### Modelo persistido

Cada agregado do domínio será serializado e validado antes da criptografia:

- compra: estabelecimento, data, total, itens e identificadores fiscais;
- rascunho: conteúdo completo ainda não confirmado;
- lista: nome, itens, quantidades e estimativas;
- comparação: sessão, cotações e respectivos itens.

O servidor poderá ver somente identificadores opacos, proprietário, versão,
tamanho aproximado e timestamps necessários para sincronização. Mesmo esses
metadados devem ser minimizados e não podem ser usados como produto de analytics.

Relatórios, busca, categorização e comparação sobre dados individuais passam a ser
calculados no dispositivo após descriptografia. Índices locais devem ser derivados
do plaintext e nunca sincronizados sem criptografia.

### Analytics

Na primeira fase E2EE, analytics entre usuários será desativado. Uma fase posterior
poderá aceitar contribuições agregadas e explicitamente opt-in geradas no cliente,
com limiar mínimo, limitação por usuário e privacidade diferencial. Esses agregados
nunca poderão ser ligados a `user_id`, compra ou ciphertext individual e não devem
ser descritos como E2EE se revelarem valores individuais ao servidor.

## Ameaças cobertas e limites

O desenho protege o conteúdo contra leitura por administrador, vazamento de backup,
service role comprometida e acesso direto ao banco. Não protege um dispositivo
desbloqueado e comprometido, screenshots, dados antes de serem criptografados no
cliente nem metadados mínimos de sincronização. RLS, quotas, rate limits, TLS e
validação continuam obrigatórios: E2EE não substitui controles de autorização.

## Plano de entrega

1. Inventariar todos os campos e RPCs que recebem plaintext e criar vetores de teste
   independentes para criptografia, adulteração, rotação e recuperação.
2. Implementar o módulo criptográfico e o fluxo de recuperação atrás de feature
   flag. Como a biblioteca será nativa, distribuir um novo APK antes de gravar o
   primeiro ciphertext; uma OTA isolada não é suficiente.
3. Adicionar tabelas/colunas de envelopes criptografados sem remover o modelo atual.
   Novas contas usam E2EE; contas existentes recebem uma migração local retomável.
4. Após desbloqueio do usuário, baixar cada agregado, criptografá-lo localmente,
   conferir round-trip e só então apagar seu plaintext. Registrar apenas estado e
   versão da migração, nunca conteúdo ou chave.
5. Mover relatórios e comparações restantes para o cliente. Revogar RPCs e colunas
   plaintext quando a telemetria agregada indicar que a migração terminou.
6. Fazer auditoria externa do protocolo e teste de recuperação em múltiplos
   dispositivos antes de declarar a promessa admin-blind como entregue.

## Critérios de aceite

- Um dump completo do Supabase não revela estabelecimento, itens, valores ou datas.
- Service role e administrador não conseguem descriptografar um agregado de teste.
- Alterar ciphertext, associated data ou versão da chave causa falha fechada.
- Pareamento, recuperação, rotação e migração interrompida possuem testes end-to-end.
- Um usuário consegue exportar e descriptografar os próprios dados sem depender do
  provedor, e a perda definitiva da chave é explicada antes da ativação.
- Nenhum fluxo E2EE depende exclusivamente de OTA para introduzir código nativo.

## Consequências

A decisão reforça a missão de privacidade, mas reduz consultas server-side, torna
recuperação e sincronização mais complexas e exige um novo APK. Até a conclusão das
fases acima, a comunicação pública deve dizer “isolamento por RLS e acesso
administrativo controlado”, não alegar que o servidor é incapaz de ler os gastos.
