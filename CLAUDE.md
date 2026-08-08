# CLAUDE.md — Clinik.Club

SaaS de funis de captação de leads para clínicas odontológicas, com CRM, cupons, cobrança Stripe e alertas de WhatsApp. Produção: **https://clinik.club** (alias kindred-ignite-forge.lovable.app). Repo: github.com/alaorpedro/clinik-club. Projeto Lovable: `f6c0c93d-41eb-463c-89ff-ab117eaa47a7` (workspace Onmid).

## ⚠️ O banco é ÚNICO — preview e produção compartilham o mesmo Supabase

Não existe banco de staging. Qualquer INSERT/UPDATE/DELETE feito "em dev" atinge dados reais de clientes pagantes. Antes de qualquer write: conferir se é reversível, preferir dados nas contas internas de teste, e apagar o que criar. DDL e queries podem ser executadas direto pelo MCP do Lovable (`query_database` com o project_id acima) — não gasta créditos.

## Fluxo dev → produção

1. Editar código localmente (nunca via prompt do Lovable — gasta créditos).
2. `git push` → Lovable sincroniza o **preview** em ~1 min (conferir `latest_commit_sha` via MCP `get_project`).
3. **Push NÃO atualiza produção.** Publicar via MCP `deploy_project` ou Publish→Update na UI do Lovable.

Dev local: `npm run dev` (Vite, porta 8080; launch config global `kindred-ignite-forge`). Limite: não há `SUPABASE_SERVICE_ROLE_KEY` local, então toda página que depende de server function quebra — o teste de verdade é no preview do Lovable ou em produção com dados temporários.

## Stack e estrutura

TanStack Start (rotas por arquivo em `src/routes/`) + React + Tailwind/shadcn. Supabase (auth + Postgres) via Lovable Cloud. Stripe live. Server functions em `src/lib/*.functions.ts` (`createServerFn`); código server-only em `*.server.ts`.

- Públicas: `/` (site), `/planos`, `/cadastro`, `/login`, `/f/$slug` (funil público), `/checkout/return`, `/api/public/payments/webhook` (Stripe).
- Autenticadas (`_authenticated/`): `/app` (dashboard), `/app/funis/$id/editar` e `/leads`, `/app/crm/*`, `/app/cupons`, `/app/conta`, `/app/admin` (+ `/pagamentos`, `/nf`).

**Pegadinha TanStack Router:** `app.admin.tsx` não renderiza `<Outlet/>`; subpágina aninhada `app.admin.X.tsx` só muda a URL sem renderizar. Subpáginas do admin usam o escape `app.admin_.X.tsx` (des-aninha mantendo a URL).

**Pegadinha types.ts:** `src/integrations/supabase/types.ts` é gerado pelo Lovable. Tabela criada por fora (via MCP) não existe nos tipos — usar cast (`as unknown as SupabaseClient`) até o Lovable regenerar.

## Funis (núcleo do produto)

Tabelas: `funnels` (owner_id, name, slug, status draft/published, theme, clinic_name, clinic_logo_url, gtm_id, meta_pixel_id, sheets_webhook_url) → `funnel_steps` (order, type, config jsonb) → `leads` (name/email/phone, answers jsonb, utm, session_id, status partial/completed, last_step_index).

Tipos de etapa (editor em `app.funis.$id.editar.tsx`, render público em `f.$slug.tsx`):

| type | label | config relevante |
|---|---|---|
| `text` | Texto / CTA | title, body, cta |
| `single` | Escolha única | options `[{label, action: continue\|disqualify\|jump, targetStepId}]` |
| `multiple` | Múltipla escolha | options (string[]) |
| `input` | Campo de texto | placeholder |
| `lead` | Página final | title, subtitle (tela de obrigado + auto-submit) |
| `contact` | Dados de contato | `fields: {name, phone, city, neighborhood}` + placeholders por campo |

Regras do `contact`: **sem `cfg.fields` = só nome+telefone** (compat com funis antigos); no editor os campos são removidos pelo "×" no mockup ou por switches na aba Conteúdo, sempre com ≥1 ativo. Nome/telefone vão para colunas do lead; **cidade/bairro vão em `answers` com as chaves fixas `"Cidade"` e `"Bairro"`** — `buildSheetsLeadPayload` (funnels.functions.ts) só as inclui no Sheets/WhatsApp se o campo estiver ativo na config. Não existe mais o tipo `contact_full` (existiu por ~1h em 30/07; a única etapa foi migrada).

Fluxo do lead: `upsertPartialLead` salva parcial por `session_id` a cada avanço; `submitLead` completa, respeita o limite mensal do plano do dono, e dispara webhook do Sheets + alerta WhatsApp. Rate limiting via `public_action_log` (`checkAndLogRate`). Config das demais chaves visuais da etapa (mídia, tamanhos, cores, ctaDelaySeconds) — ver `StepView`/`PhonePreview`.

## Planos e Stripe

`plan-limits.ts`: free 0 funis/0 leads · starter 1/400 · pro 10/2.000 · agency ∞/20.000. Conta Stripe live `acct_1TGrhpDd8MyDPCmQ`; plano vendido na prática: Pro R$159/mês. Catálogo tem produtos duplicados (dois trios criados via Lovable). Webhook com tabela `processed_webhook_events` (idempotência). Add-ons: CRM e Alertas WhatsApp (R$29,90).

Contas internas de teste (cupom, R$0,99/mês): alaorpedro@gmail.com, matheus@onmid.com.br, lynconoliveira994@gmail.com. O funil "ClinicaB" (alaor@onmid.com.br) é de teste.

## Admin e NF

`/app/admin/pagamentos` lista cobranças; `/app/admin/nf` marca NF emitida em `payment_nf_status` (service-role only). Dados de faturamento em `billing_profiles` — chaves únicas `stripe_customer_id` E `user_id`; escrita sempre via server function casando pelas duas chaves para não duplicar linha.

## Robustez — backlog

`.lovable/plan.md` tem a auditoria por blocos de risco. Status conhecido (30/07): item 6 (rate limiting nos endpoints públicos) **feito**; item 2 parcialmente (existe `processed_webhook_events`, falta conferir checagem de `.error` e o `listUsers` hardcoded). Os demais itens precisam ser revalidados contra o código antes de atacar — o plano é mais velho que o código.

## Convenções

UI 100% pt-BR. Erro para o usuário final é sempre mensagem legível (toast/popup claro), nunca stack técnico cru. Commits em inglês, mensagens curtas.
