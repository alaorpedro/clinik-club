// Fixture do protótipo mockado do inbox (Fase 3a, docs/crm-plano.md). Dados 100%
// em memória — nada aqui bate em `crm_channels`/`crm_conversations`/`crm_messages`
// (que ainda não existem); o objetivo é validar UX antes de investir em infra real.

export type Stage = { id: string; name: string; color: string };

// Mesmo conjunto de DEFAULT_STAGES do pipeline real (crm.functions.ts) — o
// protótipo assume que o inbox conversa com o pipeline já existente, não um novo.
export const STAGES: Stage[] = [
  { id: "novos-leads", name: "Novos Leads", color: "blue" },
  { id: "em-atendimento", name: "Em Atendimento", color: "amber" },
  { id: "agendou", name: "Agendou", color: "violet" },
  { id: "compareceu", name: "Compareceu", color: "cyan" },
  { id: "fechou", name: "Fechou", color: "emerald" },
  { id: "perdeu", name: "Perdeu", color: "rose" },
];

export type Member = { userId: string; email: string };

export const CURRENT_USER_ID = "u-alaor";

export const MEMBERS: Member[] = [
  { userId: CURRENT_USER_ID, email: "alaorpedro@gmail.com" },
  { userId: "u-ana", email: "ana.souza@clinica.com" },
  { userId: "u-bruno", email: "bruno.lima@clinica.com" },
];

export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export type Message = {
  id: string;
  direction: "in" | "out";
  type: "text" | "audio" | "image";
  body?: string;
  durationSec?: number;
  imageCaption?: string;
  time: string;
  status?: MessageStatus;
};

export type Note = { id: string; body: string; time: string };

export type Conversation = {
  id: string;
  contactName: string;
  phone: string;
  channel: "Evolution";
  stageId: string;
  assigneeId: string | null;
  tags: string[];
  unread: number;
  aiActive: boolean;
  messages: Message[];
  notes: Note[];
};

export const QUICK_REPLIES: { shortcut: string; text: string }[] = [
  {
    shortcut: "/oi",
    text: "Olá! Tudo bem? Aqui é da clínica, vi que você tem interesse em agendar uma avaliação. Posso te ajudar?",
  },
  {
    shortcut: "/horarios",
    text: "Temos horários disponíveis amanhã às 9h, 14h e 16h. Algum desses funciona pra você?",
  },
  {
    shortcut: "/endereco",
    text: "Ficamos na Av. Principal, 1200 — em frente à praça. Tem estacionamento no local.",
  },
  {
    shortcut: "/valor",
    text: "A avaliação inicial é gratuita! O valor do tratamento a gente conversa depois do diagnóstico, cada caso é diferente.",
  },
  {
    shortcut: "/confirmar",
    text: "Perfeito, consulta confirmada! Qualquer imprevisto é só chamar por aqui.",
  },
];

export const CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    contactName: "Marina Ferreira",
    phone: "(11) 98221-3345",
    channel: "Evolution",
    stageId: "novos-leads",
    assigneeId: null,
    tags: ["Instagram"],
    unread: 2,
    aiActive: true,
    notes: [],
    messages: [
      { id: "m1", direction: "in", type: "text", body: "Oi, vi o anúncio de implante no Instagram", time: "09:12" },
      { id: "m2", direction: "in", type: "text", body: "Vocês atendem esse mês ainda?", time: "09:12" },
    ],
  },
  {
    id: "c2",
    contactName: "Carlos Eduardo",
    phone: "(11) 97765-2210",
    channel: "Evolution",
    stageId: "em-atendimento",
    assigneeId: CURRENT_USER_ID,
    tags: ["Meta Ads", "Recorrente"],
    unread: 0,
    aiActive: false,
    notes: [
      { id: "n1", body: "Já fez avaliação em 2025, quer orçamento novo pra clareamento.", time: "ontem 18:40" },
    ],
    messages: [
      { id: "m1", direction: "in", type: "text", body: "Bom dia! Queria saber sobre clareamento dental", time: "08:03" },
      { id: "m2", direction: "out", type: "text", body: "Bom dia, Carlos! Claro, temos duas opções: a laser e a caseira com moldeira. Quer que eu explique as duas?", time: "08:05", status: "read" },
      { id: "m3", direction: "in", type: "audio", durationSec: 18, time: "08:07" },
      { id: "m4", direction: "out", type: "text", body: "Perfeito, entendi! Vou te mandar os valores.", time: "08:09", status: "delivered" },
    ],
  },
  {
    id: "c3",
    contactName: "Juliana Prado",
    phone: "(11) 99112-8890",
    channel: "Evolution",
    stageId: "agendou",
    assigneeId: CURRENT_USER_ID,
    tags: ["Google Ads"],
    unread: 0,
    aiActive: true,
    notes: [],
    messages: [
      { id: "m1", direction: "in", type: "text", body: "Consegui o horário de quinta 14h mesmo?", time: "07:40" },
      { id: "m2", direction: "out", type: "text", body: "Consegui sim, já deixei reservado aqui! Só confirmar um dia antes.", time: "07:44", status: "read" },
      { id: "m3", direction: "in", type: "image", imageCaption: "Minha carteirinha do convênio", time: "07:45" },
    ],
  },
  {
    id: "c4",
    contactName: "Roberto Alves",
    phone: "(11) 98890-1123",
    channel: "Evolution",
    stageId: "novos-leads",
    assigneeId: null,
    tags: ["Facebook", "Mora longe"],
    unread: 1,
    aiActive: true,
    notes: [],
    messages: [
      { id: "m1", direction: "in", type: "text", body: "Oi, vocês tem unidade na zona norte?", time: "10:20" },
    ],
  },
  {
    id: "c5",
    contactName: "Fernanda Costa",
    phone: "(11) 97001-4432",
    channel: "Evolution",
    stageId: "compareceu",
    assigneeId: "u-ana",
    tags: ["Instagram", "Não atende"],
    unread: 0,
    aiActive: false,
    notes: [{ id: "n1", body: "Faltou na primeira tentativa, remarcado por telefone.", time: "há 2 dias" }],
    messages: [
      { id: "m1", direction: "out", type: "text", body: "Oi Fernanda! Passando pra confirmar sua consulta de amanhã às 10h.", time: "ontem 16:00", status: "read" },
      { id: "m2", direction: "in", type: "text", body: "Confirmado, obrigada!", time: "ontem 16:12" },
    ],
  },
  {
    id: "c6",
    contactName: "Diego Martins",
    phone: "(11) 96654-7789",
    channel: "Evolution",
    stageId: "fechou",
    assigneeId: "u-bruno",
    tags: ["Meta Ads"],
    unread: 0,
    aiActive: false,
    notes: [],
    messages: [
      { id: "m1", direction: "in", type: "text", body: "Fechado, pode agendar o procedimento", time: "seg 11:00" },
      { id: "m2", direction: "out", type: "text", body: "Show, Diego! Vou te passar as datas disponíveis ainda hoje.", time: "seg 11:05", status: "read" },
    ],
  },
  {
    id: "c7",
    contactName: "Patrícia Nunes",
    phone: "(11) 98123-6674",
    channel: "Evolution",
    stageId: "novos-leads",
    assigneeId: null,
    tags: ["Google Ads"],
    unread: 3,
    aiActive: true,
    notes: [],
    messages: [
      { id: "m1", direction: "in", type: "text", body: "Boa tarde, gostaria de agendar uma avaliação", time: "13:02" },
      { id: "m2", direction: "in", type: "text", body: "É pra implante mesmo, já tirei o dente", time: "13:03" },
      { id: "m3", direction: "in", type: "audio", durationSec: 34, time: "13:04" },
    ],
  },
  {
    id: "c8",
    contactName: "Eduardo Lima",
    phone: "(11) 97556-9012",
    channel: "Evolution",
    stageId: "perdeu",
    assigneeId: "u-ana",
    tags: ["Recorrente", "Não atende"],
    unread: 0,
    aiActive: false,
    notes: [{ id: "n1", body: "Achou o valor alto, disse que ia pensar. Sem retorno há 20 dias.", time: "há 3 semanas" }],
    messages: [
      { id: "m1", direction: "out", type: "text", body: "Oi Eduardo, tudo bem? Ficou alguma dúvida sobre o orçamento?", time: "há 3 semanas", status: "read" },
    ],
  },
];
