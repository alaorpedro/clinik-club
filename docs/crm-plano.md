# Plano do CRM Clinik.Club

Este é o backlog completo do CRM — tudo que queremos construir, referenciado em
`crm-referencia-crmax.md` (inventário das 25 telas do CRMax que o Alaor mandou em
08/08/2026). Este doc responde *o quê* e *em que ordem*; a implementação de cada fase
vira sessão própria quando for a vez dela.

**Preço:** fora de escopo aqui. O add-on hoje cobra R$97/mês avulso
(`price_id: crm_addon_monthly`, ver `app.crm.upgrade.tsx`), mas a ideia é reposicionar
para a faixa de R$700–900. Repensar plano/Stripe é conversa separada, depois que o
produto justificar o preço.

---

## Restrição inegociável

**O funil (produto principal, quem paga a conta hoje) não pode quebrar em hipótese
nenhuma.** Isso governa como cada fase é feita, não só o quê:

- Schema novo do CRM é sempre **aditivo** — tabelas novas, nunca alterar
  `funnels`/`funnel_steps`/`leads` para acomodar o CRM.
- Como não existe staging (preview e produção compartilham o mesmo Supabase — ver
  CLAUDE.md), qualquer DDL/write de teste do CRM roda contra as contas internas de
  teste, nunca contra dado de cliente pagante do funil.
- O CRM já vive isolado em `/app/crm/*`; isso continua — nenhuma mudança de fase
  encosta em rota, server function ou middleware compartilhado do funil sem revisão
  explícita.
- Se alguma fase exigir tocar em código compartilhado (ex: auth, webhook do Stripe),
  isso é sinalizado *antes* de mexer, não descoberto depois.

## Onde estamos hoje (baseline — não refazer)

Arquitetura já decidida e no ar: **dentro do app** (`/app/crm/*`), mesmo Supabase, mesma
sessão de auth, gate por assinatura ativa do add-on — igual para conta nova ou conta que
já comprou funil, sem distinção de código (`hasCrmAccess()` em `crm.functions.ts`).

O que já existe e funciona:
- **Pipeline/kanban** (`app.crm.pipelines.tsx`, 211 linhas) — funcional.
- **Leads** (`app.crm.leads.tsx`, 85 linhas) — funcional.
- **Upgrade/paywall** (`app.crm.upgrade.tsx`) — checkout embutido do Stripe.
- Schema: `crm_pipelines`, `crm_stages` (nome, cor, ordem), `crm_lead_cards`
  (pipeline, etapa, posição, assignee, status), `crm_members` (papel por usuário),
  `crm_notes` (nota por card), `crm_events` (payload jsonb — timeline do card).

O que existe só como placeholder ("Em construção"/"Em breve"):
- `app.crm.relatorios.tsx` (25 linhas)
- `app.crm.configuracoes.tsx` (25 linhas)

O que **não existe ainda**: nenhuma rota de atendimento/inbox. `evolution.server.ts`
(114 linhas) só sabe criar grupo e mandar mensagem *para* um grupo — não lê nem
armazena conversa 1:1, que é o que o inbox precisa.

---

## Fases

### Fase 1 — Fechar Pipeline & Leads

Terminar o que já foi começado antes de abrir frente nova.

- Múltiplos pipelines por clínica (schema já suporta — falta UI de criar/editar/apagar pipeline e reordenar etapas).
- Etiquetas coloridas por hash estável do nome (regra do design-system.md §2 — nunca cor livre).
- Busca e filtro no kanban (por etiqueta, atendente, origem).
- Distribuição por atendente — `assignee_id` já existe, falta UI de atribuir/reatribuir.
- Regras de arraste no kanban: estado de "pegar", placeholder de destino, soltar —
  **ainda não escritas em nenhum doc** (design-system.md §4 marca isso como pendência
  em aberto desde o começo do brand pass). Definir aqui antes de implementar.
- Timeline do lead usando `crm_events` (hoje a tabela existe, mas nada escreve nela
  fora do pipeline básico).

### Fase 2 — Configurações essenciais

- Editor de pipelines/etapas (nome, cor, ordem, etapa padrão de entrada).
- Equipes/atendentes: convite, papel (`crm_member_role` já existe no enum), remoção.
- Importar contatos/cards: wizard Upload → Mapeamento → Preview → Importação (xlsx/csv,
  como no CRMax — ver `crm-referencia-crmax.md` §3).

### Fase 3 — Atendimento (inbox WhatsApp) — maior esforço, é o núcleo do produto

No CRMax é descrito como "o coração do produto" — provavelmente vale o mesmo aqui.
Divide em duas etapas: primeiro mockado (validar a UI/UX sem depender de infra nova),
integração real só depois de aprovado.

**3a — Protótipo mockado (primeiro passo).** Tela inteira funcional com dados fake em
memória/fixture — sem `crm_channels`/`crm_conversations`/`crm_messages` reais, sem
Evolution API, sem webhook. Objetivo é destravar decisão de UX antes de investir em
infra:
- Abas Novos/Meus/Outros (fila → atribuição), lista de conversas fake.
- Janela de conversa com mensagens de exemplo (texto, áudio com player, mídia).
- Respostas rápidas, trocar etapa do pipeline direto da conversa, notas internas.
- Toggle "IA ativa" (visual, sem IA de verdade ainda).
- Estado otimista de envio (mensagem aparece na hora, antes de qualquer confirmação) —
  pendência do design-system.md §4, decidir e implementar aqui mesmo em mock.
- Regras de arraste/interação validadas com o Alaor usando o protótipo antes de gastar
  tempo em backend.

**3b — Integração real (depois que o mock for aprovado).** Exige schema novo:
- `crm_channels` — conexão WhatsApp por clínica (permite multi-canal).
- `crm_conversations` — uma por contato/canal, com etapa de pipeline associada.
- `crm_messages` — histórico de mensagens (texto, áudio, mídia), direção in/out.

Funcionalidades:
- Conectar número via Evolution API (expandir `evolution.server.ts` de "mandar pra
  grupo" para conversa 1:1 completa — enviar **e receber**, via webhook).
- Tempo real: Supabase Realtime nos canais de conversa (evita polling).
- Áudio/anexos reais — armazenamento em Supabase Storage.

**Decisão técnica em aberto antes de começar o 3b:** Evolution API (não-oficial, já
integrada, mais barata) cobre conversa 1:1 e recebimento? Ou precisa migrar/complementar
com WhatsApp Cloud API oficial (exigido só para templates de disparo em massa, Fase 5)?
Como o 3a é mockado, essa decisão não bloqueia começar a fase — só precisa estar
resolvida antes do 3b.

### Fase 4 — Relatórios

- Central de Métricas: funil Leads → Agendados → Compareceram → Fechamentos, meta
  mensal configurável, projeção no ritmo atual, alertas ("taxa de agendamento abaixo da
  meta").
- Relatório por origem (de qual etiqueta/campanha veio cada lead).
- Leads parados (sem movimento há N dias).
- Export XLSX/CSV.
- Dashboard de Ads (Meta/Google) fica para a Fase 6 — depende de integração de anúncios.

### Fase 5 — Automações e IA

- Gatilhos por etapa ("quando card entrar em X, fazer Y") e por etiqueta.
- Sequências de mensagens automáticas (cadência programada).
- Templates WhatsApp oficiais via Cloud API (aprovação Meta) — para disparo em massa,
  diferente do canal 1:1 da Fase 3.
- Copiloto de IA no CRM: respostas sugeridas para o atendente, perguntas sobre métricas
  ("vou bater a meta esse mês?", "quais leads estão parados?"), mover card por comando.

**Como a IA funciona — respondendo direto às perguntas em aberto:**

- **Qual IA.** Recomendo Claude (API da Anthropic) — é o que o próprio CRMax usa
  ("Powered by Claude" no painel de IA, ver `crm-referencia-crmax.md` §5), tem tool-use
  maduro pra ações tipo "mover card"/"consultar métrica", e o Alaor já opera nesse
  ecossistema. Não é decisão travada, mas é o ponto de partida natural.

- **"Cada cliente tem uma IA"?** Não no sentido de modelo separado — isso não existe
  em LLM (não se treina um modelo por cliente). É **uma única integração no servidor**,
  e o que isola cada clínica é o **contexto e as permissões**, não o modelo: cada
  conversa só recebe dados daquele `owner_id` (pipeline, leads, métricas dele) e só
  consegue chamar as mesmas server functions que o próprio usuário logado naquela conta
  já pode chamar — mesma trava de auth que protege leads e funis hoje. Na prática, o
  "raio de ação" da IA é idêntico ao de um usuário comum daquela conta, nunca maior.

- **Quem paga.** É decisão de produto, duas rotas possíveis:
  - **A — Embutido (recomendado pra começar):** o preço do add-on (R$700–900) já
    embute o custo de IA; a plataforma paga direto com uma chave de API própria, com um
    limite suave por conta (ex.: N mensagens/dia — passou disso, IA some até o próximo
    ciclo, sem cobrar excedente). Mais simples de operar e de vender.
  - **B — Medido:** cota incluída + cobrança de excedente à parte. Mais justo com o
    custo real, mais complexo de implementar e de explicar pro cliente.
  - Como o preço já está sendo reposicionado pra cima, A dá margem suficiente pra
    começar sem se preocupar com isso — migrar pra B só se o custo real virar problema.

- **Como funciona o token.** Duas coisas diferentes com o mesmo nome:
  - *Token de uso (o que gera custo):* cada mensagem trocada consome uma quantidade de
    tokens proporcional ao que é enviado pro modelo (instrução do sistema + dados do
    cliente que entraram no contexto + histórico da conversa) e ao que ele responde.
    Pergunta curta custa centavos; sessão longa com muito contexto de CRM custa mais —
    isso é o que o limite suave da opção A existe para conter.
  - *Token de credencial (a chave da API):* uma única chave da Anthropic guardada como
    secret no servidor, mesmo padrão que já usamos hoje pra `SUPABASE_SERVICE_ROLE_KEY`
    e chaves do Stripe — nunca exposta ao navegador do cliente. Não existe "chave por
    cliente"; o que existe por cliente é um contador de uso (tabela própria ou reaproveitar
    o padrão de `crm_events`) pra aplicar o limite da opção A.

### Fase 6 — Integrações avançadas

- Meta Ads / Google Ads: rastrear origem de campanha por lead, métricas de investimento
  e ROI, eventos de conversão.
- Webhooks configuráveis por evento do sistema, com log de execução.
- API própria com token — permite automações externas tipo n8n (o CRMax vende isso
  como diferencial).
- Modo TV — dashboard para telão da clínica.

---

## Fora de escopo (mapeado na referência, não faz sentido para nós)

- **Multi-organização** — CRMax é multi-tenant com seletor de org; aqui cada clínica já
  é isolada por `owner_id`, não precisa dessa camada.
- Add-ons pagos à parte dentro do próprio CRM (Max Guru, Analisador de Conversas, Pacote
  VOIP) — interessante como inspiração de precificação futura, não como algo a construir
  agora.

---

## Ordem recomendada

1 → 2 → 3 são sequenciais (cada uma depende da anterior estar minimamente sólida).
4 pode andar em paralelo com 3 depois que o pipeline básico da Fase 1 estiver fechado,
já que relatório de conversão não depende do inbox. 5 e 6 só fazem sentido depois que 3
estiver em produção com clientes reais usando.
