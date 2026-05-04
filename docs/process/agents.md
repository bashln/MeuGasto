# Políticas e Processos para Agentes

Este arquivo documenta as políticas e processos que regem mudanças em produção
realizadas por ferramentas/agentes automatizados.

## Escopo

- Mudanças diretas em produção devem seguir validação prévia.
- Commits devem ser atômicos e conter mensagens descritivas.
- Toda alteração em schema de banco deve passar por migration versionada.

## Skills Relacionadas

Consulte `.agents/skills/` para detalhes de implementação das skills ativas.
