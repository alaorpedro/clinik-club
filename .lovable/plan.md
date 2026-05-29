# Revisão do sistema — Plano de melhorias

Auditei 4 áreas em paralelo (performance, confiabilidade, UX/onboarding, segurança). Agrupei por **risco para clientes ativos**, do mais urgente ao polimento.

---

## 🔴 BLOCO 1 — Críticos (fazer agora)

Risco imediato a clientes pagantes ou dados. Recomendo fazer **tudo** deste bloco numa rodada.

1. **`deleteFunnel` sem autenticação** (`src/lib/funnels.functions.ts:304`)
   Qualquer um com o UUID de um funil pode deletá-lo via POST. Falta `.middleware([requireSupabaseAuth])` e checagem de `owner_id`.

2. **Webhook Stripe com falhas silenciosas e sem idempotência** (`src/routes/api/public/payments/webhook.ts`)
   - Nenhum `.error` é checado nos `upsert/update` → plano pode não ativar e ninguém saber.
   - Sem tabela `processed_webhook_events` → re-entrega da Stripe duplica efeito.
   - `listUsers({ perPage: 1000 })` hardcoded → após 1000 contas, vínculo por email quebra silenciosamente.

3. **Trigger `handle_new_user` sem `EXCEPTION WHEN OTHERS`**
   Qualquer falha no INSERT em `profiles` aborta o signup inteiro. Encapsular em bloco com exceção.

4. **Email não confirmado trava login sem feedback** (`src/routes/login.tsx:48`)
   Mostra `"Email not confirmed"` em inglês, sem botão para reenviar. Tratar erro específico + ação "Reenviar confirmação".

5. **`checkout/return` sem `session_id` exibe "Pagamento confirmado!"** (`src/routes/checkout.return.tsx:47`)
   Tela de sucesso falso. Renderizar título condicionalmente.

6. **Rate limiting básico em `submitLead`, `upsertPartialLead`, `trackStep`** (`src/lib/funnels.functions.ts`)
   Endpoints públicos sem auth e sem throttle — bot pode inflar banco e estourar cota do cliente. Tabela `public_action_log` com janela por `sessionId+IP`.

7. **Limites de tamanho em `answers/utm`** (`src/lib/funnels.functions.ts:115,229`)
   Validar JSON ≤ 50KB para evitar payload abusivo.

---

## 🟠 BLOCO 2 — Confiabilidade & performance alta (fazer em seguida)

Não trava ninguém hoje, mas degrada à medida que cresce.

8. **Loader na dashboard + paralelizar 4 round-trips serial** (`src/routes/_authenticated/app.index.tsx:36-66`)
   Mover queries para `loader` + `Promise.all`. Hoje são 4 esperas sequenciais antes de renderizar.

9. **`select("*")` virar select específico** em `funnels`, `funnel_steps`, `leads`, `subscriptions` (5 locais)
   Reduz payload e CPU.

10. **Paginação real na view de leads do funil** (`src/routes/_authenticated/app.funis.$id.leads.tsx:25`)
    Hoje carrega todos os leads sem `.limit()`. Adicionar paginação + filtro por status.

11. **Batch save no editor** (`src/routes/_authenticated/app.funis.$id.editar.tsx:134,224`)
    Trocar N requests por upsert único / RPC. Hoje 11+ requests simultâneos com 10 steps.

12. **Indexes faltando** em `leads(funnel_id, created_at)`, `crm_lead_cards(pipeline_id, status, position)`, `subscriptions(user_id, environment)` — migração SQL.

13. **Captura de erros global no frontend** (`src/routes/__root.tsx`)
    Adicionar `ErrorBoundary` + log estruturado para `email_send_log`-style table `client_errors`. Permite saber quando cliente vê tela branca.

14. **Mensagens de erro amigáveis** — função `humanizeSupabaseError()` central, substituir todos os `toast.error(error.message)` (10+ locais) por mensagens PT-BR.

---

## 🟡 BLOCO 3 — UX & retenção

15. **Kanban CRM não funciona em mobile** (`src/routes/_authenticated/app.crm.pipelines.tsx:69`)
    Adicionar `TouchSensor` do `@dnd-kit/core`. Solução de 3 linhas.

16. **Tabela de leads CRM sem scroll horizontal mobile** (`src/routes/_authenticated/app.crm.leads.tsx:56`) — wrap em `overflow-x-auto`.

17. **Status do funil em PT-BR** (`src/routes/_authenticated/app.index.tsx:216`) — "draft" → "Rascunho", etc.

18. **Skeletons em vez de "Carregando..."** no dashboard, editor e CRM (3 locais).

19. **Botão "Publicar" desabilitado durante save** (`app.funis.$id.editar.tsx:367`) — evita duplo-clique publicando dados velhos.

20. **Remover ou marcar como "Em breve"**: features Agency não implementadas (`src/routes/planos.tsx:54`) — subcontas, white-label, API. Risco de chargeback.

21. **Acessibilidade básica**: `aria-label` em botões-ícone do editor, `htmlFor` no campo email da conta, foco em "Cancelar" nos modais destrutivos.

22. **Lazy-load `@dnd-kit`** na rota CRM pipelines (~40KB gz a menos no bundle autenticado).

23. **`loading="lazy"` + `width/height`** em imagens de funil público (`src/routes/f.$slug.tsx`) — melhora LCP e elimina CLS.

---

## 🟢 BLOCO 4 — Onboarding (projeto separado, maior)

24. **Tela "Verifique seu email" pós-signup** com CTA para reenviar + link para /planos.

25. **Empty state acionável** em `/app` quando sem funil: tour de 3 passos (criar funil → publicar → primeiro lead).

26. **Checklist de ativação** persistente no dashboard até o usuário criar funil + ativar plano + receber 1º lead.

> Bloco 4 é um sub-projeto maior. Sugiro fazer depois dos blocos 1-3 e em uma rodada dedicada.

---

## Como sugiro proceder

Posso executar **bloco a bloco** (você aprova cada um antes do próximo), ou tudo de uma vez se preferir.

**Recomendação:** começar pelo **Bloco 1 (críticos)** agora — é o que protege os clientes pagantes que já estão usando. Depois conversamos sobre 2 e 3.
