# Política de auditoria de dependências

O Quality executa `scripts/dependency-audit.mjs` para bloquear vulnerabilidades `high` e `critical` detectadas por `npm audit`.

## Exceção temporária

A única exceção permitida é para os advisories de `image-size` abaixo:

- `GHSA-w3rx-r6r6-pgpr` / source `1138808`;
- `GHSA-5p2g-fcmc-qvqq` / source `1138809`.

Eles são transitivos de `Expo -> Metro -> image-size`, afetam principalmente o processamento de imagens do toolchain de build e, no momento, não possuem uma versão corrigida publicada: a faixa vulnerável inclui `image-size <= 2.0.2`.

A exceção expira em **2026-10-01**. Ela deve ser removida assim que uma atualização compatível de Expo/Metro trouxer uma versão corrigida. Não use `npm audit fix --force` nem faça downgrade do Expo apenas para silenciar o audit.

## Riscos moderados conhecidos

`undici` é transitivo de Expo/Sentry CLI. Ele continua sendo revisado em cada atualização do Expo SDK, mas não desbloqueia vulnerabilidades `high` ou `critical` no CI.

## Regras

- Qualquer vulnerabilidade `critical` falha o CI.
- Qualquer vulnerabilidade `high` que não corresponda exatamente à exceção acima falha o CI.
- Novas exceções exigem advisory, justificativa, prazo de revisão e teste que prove que a allowlist não é ampla demais.
- Alertas Dependabot não devem ser fechados em massa; alertas resolvidos devem fechar após a atualização chegar ao branch padrão.
