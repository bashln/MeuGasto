# ADR 0002 — `FLAG_SECURE` nas telas com dados financeiros

- Status: proposta (aguarda D9)
- Data: 2026-11-23
- Contexto: auditoria LGPD de 2026-11-23, achado sobre exposição de tela

## Contexto

Toda tela do MeuGasto mostra dados financeiros do titular: valores de compra, itens, mercados e histórico. Sem `FLAG_SECURE`, o Android permite captura de tela, gravação de tela e miniatura na tela de tarefas recentes. Em aparelho compartilhado ou com app de captura ativo, esses dados saem do controle do titular sem ação dele.

A exportação de dados (PR-04) já dá ao titular um caminho explícito para levar os próprios dados. Isso reduz o custo de bloquear captura.

## Decisão proposta

Aplicar `WindowManager.LayoutParams.FLAG_SECURE` na janela principal do app (`MainActivity`), cobrindo todas as telas.

Consequências:

- Captura de tela e gravação de tela ficam bloqueadas; a miniatura em "Recentes" fica em branco.
- O titular que quiser compartilhar um número usa a exportação JSON, não um print.
- Nenhuma permissão nova, nenhuma dependência nova, uma linha de código.

## Alternativas avaliadas

| Alternativa | Por que não |
| --- | --- |
| `FLAG_SECURE` só em telas específicas | Cada tela nova precisa lembrar de aplicar; o dado aparece também em telas de lista e detalhe. Uma linha na Activity é mais difícil de esquecer. |
| Não aplicar | Print e miniatura continuam expondo valores a qualquer app com captura. |
| Criptografia de banco (SQLCipher) | Resolve outro vetor (disco), não captura de tela; fica fora deste ADR, como o plano registra. |

## O que falta

D9: o operador confirma que bloqueia captura de tela em todas as telas. Se a resposta for "só nas telas de valor", este ADR muda antes da implementação.
