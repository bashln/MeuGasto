# Backlog de Implementação NFC-e

Este documento mantém o backlog técnico para evoluir a importação de NFC-e. O estado oficial de cobertura por UF fica exclusivamente em [`AGENTS.md`](../../AGENTS.md); não duplique a lista de estados neste arquivo.

## Estado consolidado

- [x] Fluxo base de importação via QR Code
- [x] Allowlist HTTPS para URLs por UF
- [x] Validação e sanitização de payload NFC-e
- [x] Compra importada como somente leitura
- [x] Testes base de serviço e validações
- [ ] Arquitetura modular e contrato comum para estratégias por UF
- [ ] Cobertura robusta por estado com fixtures e testes de contrato

## Arquitetura e isolamento por UF

- [ ] Criar registry central tipado com metadados por UF, incluindo cUF, URL base, paths permitidos e flags.
- [ ] Definir a interface única `NfceStateStrategy`.
- [ ] Implementar orquestrador de estratégias por cUF.
- [ ] Migrar a lógica de RS para uma estratégia dedicada.
- [x] Adicionar RJ como segundo estado piloto.
- [ ] Manter fallback controlado: estratégia da UF, parser genérico e fallback externo.

## Segurança e robustez

- [ ] Revisar bloqueio estrito de URL fora de HTTPS/allowlist e paths esperados por host.
- [ ] Revisar timeout, retry e mensagens de erro do WebView por classe de falha.
- [ ] Reintroduzir fallback WebView somente quando o GET-first falhar por restrição externa.

## Qualidade de dados

- [ ] Padronizar o contrato de extração de itens, data/hora e estabelecimento.
- [ ] Validar a coerência entre quantidade, preço unitário e total com tolerância definida.

## Testes

- [ ] Criar testes de contrato comuns para toda UF.
- [ ] Versionar fixtures reais por UF e golden tests de parser.
- [ ] Expandir testes de roteamento, segurança de URL/host/path e fallback.

## Operação e documentação

- [ ] Definir telemetria mínima de importação sem dados sensíveis.
- [ ] Criar relatório agregado de taxa de sucesso por UF.
- [ ] Documentar playbook e checklist de PR para adicionar uma UF.
- [ ] Atualizar o estado oficial em `AGENTS.md` após validação de uma UF.

## Histórico

- 2026-05-16: checklist inicial consolidado.
- 2026-05-16: estratégia de webscraper para RJ adicionada como piloto.
- 2026-05-17: RJ adotou GET-first com fallback WebView como processo secundário devido ao anti-bot TSPD.
