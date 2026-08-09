# Referência de CRM — CRMax (mapeado em 08/08/2026)

Fonte: 25 screenshots em `~/Downloads/telas crm` (conta do Dr Edson / Oralys Odontologia — cliente real do Alaor que usa o CRMax hoje). CRMax = painel.crmax.com.br, CRM WhatsApp-first para clínicas. Este doc é o inventário fiel do que a referência tem; as decisões do que vamos construir ficam em `crm-plano.md` (quando existir).

## Estrutura geral

- **Multi-organização**: seletor de org no topo ("Dr Edson"); usuário admin vê várias clínicas. Papéis: Admin Org / Usuário.
- **Nav principal**: Pipelines · Atendimento · Relatórios (dropdown) · Apps · Configurações. Tema claro/escuro. Notificações + chat interno.
- **Visual**: fundo creme/pêssego claro, cards arredondados suaves, accent laranja (#ff5c1a aprox.), badges colorides por etiqueta.

## Módulos

### 1. Pipelines (kanban de leads)
- Kanban com colunas custom por pipeline. Colunas vistas no funil "Leads" da Oralys: Novos Leads, Em Atendimento, Agendou, Compareceu, Desmarcou, Faltou, Fechou, Engano/Sem Interesse, Mora Longe, Atendimento Plano, Não Atende/Não Responde, Oportunidade/Retorno, Resgates–Mês Anterior ou Antes, Contato para Terceiros (~14 etapas — o fluxo real de clínica é bem mais granular que "novo→ganhou/perdeu").
- Card = lead/contato com etiquetas; busca e filtros; "+ Novo Card" por coluna; botão Etiquetas e Configurar no topo.

### 2. Atendimento (inbox WhatsApp) — coração do produto
- Abas: **Novos / Meus / Outros** (fila → atribuição por atendente).
- Card da conversa: etiquetas (origem: Meta Ads/Facebook/Instagram/Google; mês; status "Não atende", "Mora longe", "Recorrente"...), atendente, pipeline associado.
- Conversa: mensagens + áudios com player, "Emília assumiu o atendimento em ...", reações.
- Header da conversa: canal conectado, dropdown de etapa do pipeline (muda a etapa dali), **toggle "IA ativa"**, Transferir, Concluir.
- Composer: respostas rápidas (/), mencionar com @, anexos, emoji, agendar mensagem, áudio.
- Add-on "Atendimento" aparece como app R$0 ativo (inbox unificado, notas internas, etiquetas/filtros, histórico completo).

### 3. Configurações (menu lateral)
- **Canais**: conexões WhatsApp via **Evolution API** (badge "Evolution", status CONECTADO, foto/nome do número). Por canal: pipeline padrão para novos leads + equipe padrão para novos atendimentos. Multi-canal ("Adicionar Novo Canal").
- **Contatos**: base WhatsApp (8.309 total · 1.540 anúncios · 6.769 orgânico) com busca, filtro por origem/instância/etiqueta, ordenação A-Z. Etiquetas coloridas por mês de entrada, canal e status.
- **Equipes**: equipes de atendimento (ex.: "Leads", 3 usuários, marcada Padrão).
- **Gestão de Usuários**: lista com papel, último acesso, ativo/inativo, **"Entrar"** (impersonar usuário), editar, excluir.
- **API**: ID da organização + tokens Bearer (`crmax_xxx`) com acesso total — usado com **n8n**.
- **Importar Dados**: wizard 4 passos (Upload → Mapeamento → Preview → Importação); tipo **Contatos** ou **Cards (Pipeline)**; xlsx/xls/csv até 20MB.
- **Automações** (por pipeline): gatilho "Quando card entrar na etapa" → seleciona etapa → lista de ações. (Também sugerem gatilho por etiqueta.)
- **Chatbot e Automações**: builder de fluxos de atendimento com gatilhos e condições ("respondem, qualificam leads e movem cards automaticamente no pipeline").
- **Sequências**: cadências automáticas de mensagens WhatsApp — ex.: "(M) NAO ATENDE/NAO RESPONDE" e "(F) ..." com 8 mensagens, N inscritos ativos, toggle ativa/inativa. (M/F = sequência separada por gênero.)
- **Templates WhatsApp**: templates do **WhatsApp Cloud API** (oficial) p/ envio em massa: nome, idioma, categoria (Marketing...), cabeçalho, corpo com variáveis {{1}}, rodapé, até 3 botões, salvar rascunho ou "Criar e enviar para Meta" (aprovação), Sincronizar.
- **Webhooks**: por evento do sistema, com log de execução (ex.: webhook "Agente de IA" → webhook.crmax.com.br).
- **Agendamentos**: mensagens agendadas da organização (contato, conteúdo, data, criado por, status, cancelar).
- **Integrações (Ads)**: OAuth **Meta** (Facebook/Instagram — rastrear de qual campanha/anúncio veio cada lead + enviar eventos de conversão) e **Google Ads** (métricas; seleção de conta).
- **Minhas Assinaturas** + **Modo TV** (dashboard para telão da clínica).

### 4. Relatórios
- **Ads** (dashboard de tráfego): investimento, conversas iniciadas, custo por resultado, faturamento atribuído, ROI; comparativo com período anterior; funil impressões→cliques→conversas; performance diária; pizza de conversas e investimento por campanha; top campanhas e top criativos (thumbnails); tabela detalhada por campanha (Meta Ads) com status/veiculação/gasto/resultados. Filtro por canal (Meta/Google) e período.
- **Central de Métricas (CRC)**: meta mensal de faturamento configurável; projeção do mês (no ritmo atual); "para bater a meta" (vendas necessárias/dia, dias restantes); ritmo + probabilidade + alertas ("taxa de agendamento baixa: atual 16,7% | meta 35%"). Funil **Leads → Agendados → Compareceram → Fechamentos** com %; métricas financeiras (oportunidades R$, valor fechado, ticket médio, previsão); tempo médio no funil (lead→agendamento→comparecimento→fechamento); performance diária por dia do mês; rankings personalizados de atendentes; export PDF/XLSX/CSV. Aba "Origem x Faturamento".
- **Segmentado**: pipeline × segmentar por (etiquetas/campos personalizados) × cruzar com × período. Menciona **campos personalizados por pipeline**.
- **Gerencial · Leads Parados · Leads por Origem** (abas).

### 5. IA — "CRMax AI" (sidebar, literalmente "Powered by Claude")
- Painel lateral de chat com acesso aos dados: pipelines/leads, campanhas Meta, métricas de conversão/ROI, performance de vendedores.
- Ações rápidas (Meta do mês, Leads parados, Campanhas) e perguntas sugeridas ("Vou bater a meta esse mês?", "Quais leads estão parados há mais de 3 dias?").
- "Pode executar ações quando solicitado" (mover cards, enviar mensagens).

### 6. Apps & Add-ons (monetização)
| App | Preço | O quê |
|---|---|---|
| Max Guru | R$97/mês | IA p/ atendentes: respostas sugeridas, base de conhecimento própria |
| Carteiras & Comissões | R$29,90/mês | comissão automática por etapa do funil, carteira por vendedor |
| Analisador de Conversas | R$147/mês | IA analisa 100% das conversas: objeções, score, sugestões |
| Pacote VOIP | R$99/mês | click-to-call, gravação, Twilio/Asterisk |
| Atendimento | R$0 | o inbox (grátis, é a isca) |

## Leitura estratégica
- O produto é **WhatsApp-first**: canal (Evolution API não-oficial) + inbox + kanban são o núcleo; Cloud API oficial só para templates/massa. Ads e métricas fecham o ciclo "quanto virou dinheiro".
- Kanban de clínica real precisa de etapas operacionais (faltou, desmarcou, resgate, não atende), não só funil de vendas.
- IA como diferencial de marketing em 3 pontos: assistente geral, copiloto do atendente (Max Guru) e auditoria de conversas (Analisador).
- Já temos no clinik.club: funis/leads, `crm_*` (pipelines, stages, cards, members, notes, events), add-on CRM e Alertas WhatsApp no Stripe, `evolution.server.ts` (Evolution API já integrada p/ alertas) — a fundação existe; o salto é canal próprio + inbox + automações.
