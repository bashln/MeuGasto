# Plano de Melhorias — MeuGasto

## 1. Objetivo

Consolidar gaps, riscos e melhorias do repositório em tarefas organizadas, alinhadas com a missão: leitura automática de NFC-e via QR Code, controle de gastos por item/segmento/mercado, privacidade por design.

## 2. Status atual (resumo)

- App Android nativo (Kotlin + Jetpack Compose) com navegação por telas.
- NFC-e: RS e RJ implementados; 24 UFs restantes.
- Modo Nuvem (Supabase) parcial; modo local funcional.
- Funcionalidades existentes: dashboard, compras, relatórios, histórico de produto, planejamento/comparação de preços, lista de compras, perfil.

## 3. Tarefas

### A. Cobertura NFC-e (crítico)

- [ ] Implementar estratégia por UF para as 24 UFs restantes, começando pelos estados de maior volume (SP, MG, PR, SC, BA).
- [ ] Criar registry central tipado `NfceStateStrategy` com metadados (cUF, URL base, paths permitidos, flags).
- [ ] Orquestrador de estratégias por cUF com fallback controlado: UF → parser genérico → fallback externo.
- [ ] Migrar RS para estratégia dedicada (já parcial) e validar contrato comum.
- [ ] Testes de contrato comuns para toda UF.
- [ ] Fixtures reais por UF + golden tests de parser.
- [ ] Telemetria mínima de importação sem dados sensíveis + relatório agregado de taxa de sucesso por UF.
- [ ] Documentar playbook/checklist de PR para adicionar uma UF e atualizar AGENTS.md.

### B. Qualidade de dados

- [ ] Padronizar contrato de extração (itens, data/hora, estabelecimento).
- [ ] Validar coerência quantidade × preço unitário × total com tolerância definida.
- [x] Canonicalização de produtos: chave canônica por código/nome + agrupamento em relatórios.
- [ ] Corrigir drift entre schema versionado e banco Supabase.
- [ ] Testes contra falsos positivos (ex.: leite vs leite condensado).

### C. Autenticação e perfil (Modo Nuvem)

- [ ] Implementar fluxo completo Supabase: login, cadastro, recuperação de senha, perfil.
- [ ] Hardening de segurança remota (seguir docs/security/supabase-remote-security-follow-up.md).
- [ ] Auditoria de dependências (policy em docs/security/dependency-audit-policy.md).

### D. UX / Produto

- [ ] Menu e configurações completas (seções: conta, tema, notificações, dados, sobre).
- [ ] Ajustar placeholder “Nome do item” (paddingVertical 8→10) e validar em Android.
- [ ] Mostrar QR Code apenas com itens na lista de compras.
- [x] Permitir edição manual do preço estimado (estimated_price) e recalcular total.
- [ ] Comparação de itens por unidade de medida (kg, g, L, ml, un) — ver TODO_PRICE_COMPARISON.md.
- [ ] Dashboards por item/segmento/mercado com filtros de período.

### E. Arquitetura e robustez

- [ ] Revisar bloqueio estrito de URL fora de HTTPS/allowlist e paths esperados por host.
- [ ] Revisar timeout, retry e mensagens de erro do WebView por classe de falha.
- [ ] Reintroduzir fallback WebView somente quando GET-first falhar por restrição externa.
- [ ] Sincronização cloud (uploader/sync) — validar idempotência e conflitos.

### F. Qualidade / Testes

- [ ] Expandir testes de roteamento, segurança de URL/host/path e fallback.
- [ ] Testes de repositório local e uploader cloud.
- [ ] Testes de UI críticos (scanner, dashboard, compras).

### G. Distribuição e manutenção

- [ ] Manter versionCode/versionName sincronizados (build.gradle.kts + app.json).
- [ ] Garantir tags de release no formato vX.Y.Z.W.
- [ ] Revisar InAppUpdateManager (consulta GitHub Releases + FileProvider).

## 4. Priorização sugerida

1. Cobertura NFC-e (A) — core feature.
2. Qualidade de dados (B) — confiabilidade dos relatórios.
3. Auth/perfil (C) — habilita Modo Nuvem.
4. UX/produto (D) — valor percebido.
5. Arquitetura/robustez (E) — estabilidade.
6. Testes (F) e distribuição (G) — contínuo.

## 5. Riscos

- Fragmentação de nomes fiscais sem canonicalização.
- Anti-bot nos portais SEFAZ (TSPD etc.) pode exigir fallback WebView.
- Drift de schema Supabase vs código.
- Escopo de 26 UFs com portais heterogêneos.

## 6. Próximos passos imediatos

1. Validar ambiente de build (Gradle) e rodar testes existentes.
2. Escolher próxima UF piloto (sugestão: SP ou MG).
3. Criar issue/PR por UF seguindo checklist.
