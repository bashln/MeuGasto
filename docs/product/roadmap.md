# Roadmap de Produto

Este documento registra iniciativas de produto que ainda precisam de definição ou priorização. Uma vez aprovada para execução, cada unidade de trabalho deve ser acompanhada em GitHub Issues/Projects.

## Planejamento de compras

### Ajustar o campo “Nome do item”

- **Problema:** o placeholder pode ser cortado verticalmente.
- **Causa conhecida:** `paddingVertical: 8` no estilo de input de `PlanningScreen.tsx`.
- **Próximo passo:** validar o ajuste para `paddingVertical: 10` em dispositivos Android antes de implementar.

### Mostrar QR Code apenas com itens na lista

- **Problema:** o QR Code aparece no card de custo estimado mesmo quando a lista está vazia.
- **Próximo passo:** definir o fluxo desejado e, se aprovado, condicionar a ação à existência de itens.

### Permitir edição manual do preço estimado

- **Problema:** o preço estimado vem exclusivamente da média histórica.
- **Escopo inicial:** suportar `estimated_price` na atualização, oferecer edição na interface e recalcular o total estimado.

## Dados de produtos

### Canonicalização de produtos

Nomes fiscais diferentes para o mesmo produto fragmentam relatórios e histórico de preços. A proposta é manter o nome original para auditoria, normalizar aliases e associá-los a uma identidade canônica.

Antes de implementar:

1. corrigir o drift entre o schema versionado e o banco Supabase;
2. definir regras determinísticas de normalização e critérios de confiança;
3. projetar migration, backfill e fluxo de correção manual;
4. criar testes que previnam falsos positivos, como `leite` versus `leite condensado`.
