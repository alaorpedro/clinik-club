
# CRM Clinik.Club — Módulo pago (MVP)

CRM como add-on cobrado **além** do plano do funil. Quem não tiver o módulo ativo vê um paywall na rota `/app/crm`.

## Escopo do MVP

1. **Pipelines (Kanban)** — colunas customizáveis (Novos Leads, Em Atendimento, Agendou, Compareceu, Fechou, Perdeu). Arrastar lead entre etapas.
2. **Lista de Leads** com filtros (período, pipeline, etapa, campanha, atendente, origem) + exportar XLSX.
3. **Detalhe do Lead** — dados de contato, respostas do funil, timeline de eventos, anotações, botão "abrir WhatsApp".
4. **Captura automática** — toda submissão de `leads` (já existente, vinda dos funis) entra no pipeline padrão na primeira etapa.
5. **Atendentes** — convidar membros da clínica e atribuir leads (round-robin manual no MVP).
6. **Relatórios** — 4 abas: Segmentado, Gerencial, Leads Parados, Leads por Origem.
7. **Paywall** — bloqueia `/app/crm` se o usuário não tiver assinatura ativa do produto `crm_addon`.

Fora do MVP (próximas fases): integração WhatsApp Business API nativa, automações/SLA, gravação de ligações, IA de qualificação.

## Modelo de cobrança

Novo produto no Lovable Payments: **CRM Add-on** — assinatura mensal independente do plano do funil.
- `crm_addon_monthly` — R$ 97/mês (placeholder, confirmar valor)
- Validação server-side: serverFn `hasCrmAccess()` consulta `subscriptions` com `product_id = 'crm_addon'`.

## Banco de dados (novas tabelas)

```text
crm_pipelines (id, owner_id, name, is_default, created_at)
crm_stages    (id, pipeline_id, name, order, color, created_at)
crm_lead_cards(id, lead_id, pipeline_id, stage_id, assignee_id, position,
               status [active/archived], moved_at, created_at)
crm_notes     (id, lead_card_id, author_id, body, created_at)
crm_events    (id, lead_card_id, type, payload jsonb, created_at)
crm_members   (id, owner_id, user_id, role [admin/agent], created_at)
```

- `lead_card` referencia `leads.id` (tabela existente, alimentada pelos funis).
- Trigger: ao inserir em `leads`, cria automaticamente um `crm_lead_card` no pipeline default do owner do funil (se ele tem CRM ativo).
- RLS: owner vê tudo; agent vê apenas cards atribuídos a ele ou não atribuídos.

## Arquitetura de telas

```text
/app/crm                       → dashboard (KPIs rápidos) ou redirect p/ pipelines
/app/crm/pipelines             → Kanban (default pipeline)
/app/crm/pipelines/$id         → Kanban de um pipeline específico
/app/crm/leads                 → tabela de leads com filtros + export XLSX
/app/crm/leads/$id             → detalhe do lead (timeline, notas, respostas do funil)
/app/crm/reports               → abas Segmentado/Gerencial/Parados/Origem
/app/crm/settings              → pipelines, etapas, atendentes
/app/crm/upgrade               → paywall (quando sem assinatura)
```

Layout próprio com sidebar (Pipelines · Leads · Relatórios · Configurações) — usa shadcn Sidebar, colapsável.

## Detalhes técnicos

- **Guard**: layout `_authenticated/app/crm` chama `hasCrmAccess` no loader; redirect p/ `/app/crm/upgrade` se falso.
- **Server functions**: `crm.functions.ts` para listar pipelines, mover card (otimista no client), criar nota, etc. Tudo com `requireSupabaseAuth`.
- **Kanban**: `@dnd-kit/core` (já leve e compatível). Mutação otimista com TanStack Query.
- **Export XLSX**: serverFn que gera CSV/XLSX server-side e retorna como blob.
- **Realtime**: opcional na v1 — habilitar `supabase_realtime` em `crm_lead_cards` para múltiplos atendentes verem o board atualizar.

## Ordem de implementação (entrega incremental)

1. **Migração DB** + RLS + trigger de criação automática de card a partir de `leads`.
2. **Produto de pagamento** `crm_addon` + serverFn `hasCrmAccess` + paywall em `/app/crm/upgrade`.
3. **Layout do CRM** com sidebar + guard de acesso.
4. **Pipelines/Kanban** (criar pipeline default na primeira visita, drag-and-drop entre etapas).
5. **Lista de Leads** com filtros e detalhe do lead (timeline + respostas do funil).
6. **Atendentes** (convite + atribuição).
7. **Relatórios** (4 abas) + export XLSX.
8. **Polimento** — vazios, loading skeletons, toasts, mobile.

## Pontos a confirmar antes de codar

- **Preço** do add-on (sugiro R$ 97/mês — ok?).
- **Trial**: liberar 7 dias grátis do CRM pra quem já tem o funil? (recomendo sim p/ conversão)
- **Etapas default** do pipeline: posso usar as do CRMAX (Novos Leads → Em Atendimento → Agendou → Compareceu → Fechou → Perdeu)?

Posso começar pela etapa 1 (migração + paywall + layout) já com as defaults acima, e ajustamos preço/trial quando você confirmar.
