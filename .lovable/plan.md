# Odontolink — SaaS de Funis Interativos

Plataforma onde o usuário cria quizzes/funis de vendas multi-etapa, publica em URL própria, captura leads e acompanha métricas. Inspirado no inlead.digital, com marca **Odontolink** (provisória).

## Stack
- **Frontend/Backend**: TanStack Start (já configurado) + Tailwind + shadcn
- **Banco/Auth/Storage**: Lovable Cloud (Supabase gerenciado)
- **Pagamento**: **Stripe via Lovable Payments** (recomendado — não exige conta Stripe própria, assinaturas recorrentes prontas, tax handling configurável). Paddle é alternativa se preferir Merchant-of-Record total.

## Escopo da v1

### 1. Site institucional (público)
- `/` — Home (hero com mockup visual do quiz, logos de parceiros, "como funciona", depoimentos, CTA)
- `/planos` — pricing (3 planos: Starter, Pro, Agency)
- `/sobre`, `/contato`, `/blog` (placeholder)
- Header + Footer compartilhados

### 2. Autenticação
- `/login` e `/cadastro` (email/senha + Google)
- `/reset-password`
- Tabela `profiles` (nome, avatar, plano atual)

### 3. Dashboard do usuário (`/app/*`, protegido)
- `/app` — lista de funis do usuário + botão "Novo funil"
- `/app/funis/:id/editar` — **builder visual** com etapas:
  - Tipos de bloco: Texto, Escolha Única, Múltipla, Input, Botão, Imagem
  - Drag handle pra reordenar etapas
  - Preview ao lado em mockup de celular
- `/app/funis/:id/analytics` — visualizações, conversão por etapa, leads capturados (gráficos com Recharts)
- `/app/funis/:id/leads` — tabela de leads + export CSV
- `/app/conta` — perfil, troca de senha, plano atual, botão "Gerenciar assinatura" (Stripe portal)

### 4. Funil publicado (público)
- `/f/:slug` — renderiza o funil interativo do usuário, com tracking de cada etapa

### 5. Pagamento (Stripe)
- 3 produtos no Stripe (Starter R$ 47/mês, Pro R$ 97/mês, Agency R$ 297/mês)
- Checkout Stripe ao clicar em plano
- Webhook atualiza `profiles.plan` e `profiles.subscription_status`
- Limites por plano: nº de funis ativos, nº de leads/mês
- Customer Portal pra gestão de assinatura

## Modelo de dados
```text
profiles         (id→auth.users, name, avatar_url, plan, stripe_customer_id, sub_status)
funnels          (id, owner_id, name, slug, status, theme, created_at)
funnel_steps     (id, funnel_id, order, type, config jsonb)
funnel_responses (id, funnel_id, session_id, answers jsonb, completed, created_at)
leads            (id, funnel_id, email, name, phone, utm jsonb, created_at)
plan_limits      (lookup: plan → max_funnels, max_leads_month)
```
RLS: usuário só vê os próprios funis/leads. Funis publicados (`status='published'`) lidos por `anon` via server fn admin com WHERE no slug.

## Entregas em fases

**Fase 1 (esta mensagem)** — base navegável:
1. Design system Odontolink (azul royal + amarelo neon + tipografia bold)
2. Site institucional completo (home, planos, sobre, contato)
3. Ativar Lovable Cloud + auth (email/senha + Google) + páginas login/cadastro/reset
4. Shell do `/app` com sidebar + página de listagem de funis (vazia)
5. Schema do banco + RLS

**Fase 2** — builder e funil público:
6. Builder visual de funis (CRUD steps)
7. Renderizador público `/f/:slug` + captura de respostas/leads
8. Página de leads + analytics básico

**Fase 3** — monetização:
9. Ativar Stripe Payments (Lovable)
10. Checkout + webhooks + portal + enforcement de limites por plano

## Confirmações antes de começar

1. **Stripe via Lovable Payments** OK? (recomendo — zero setup, você só preenche um form depois)
2. **Posso começar pela Fase 1 agora** e a gente itera as fases 2 e 3 nas próximas mensagens? (manter mensagens menores = builds mais estáveis e você revisa cada parte)
3. **Planos/preços** acima (R$ 47 / 97 / 297) servem como placeholder ou já tem valores definidos?