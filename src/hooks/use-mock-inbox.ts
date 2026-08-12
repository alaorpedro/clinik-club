import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cloneConversations, type Conversation, type Message } from "@/lib/crm-inbox-mock";

// Fonte única do estado mockado (Fase 3a) — mensagens, IA ativa e não-lidas.
// Guardado no cache do React Query (não em useState de cada tela) pra que o
// modal do card no Pipeline e a página de Atendimento leiam e escrevam a
// MESMA conversa: mandar mensagem em um lugar aparece no outro. O resto do
// card (etapa, atendente, etiquetas, notas) já é dado real — só a conversa em
// si segue mockada até a Fase 3b (integração de verdade com WhatsApp).
const MOCK_INBOX_KEY = ["crm", "mockConversations"] as const;

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function useMockConversations() {
  return useQuery({
    queryKey: MOCK_INBOX_KEY,
    queryFn: () => cloneConversations(),
    staleTime: Infinity,
  });
}

export function useMockConversationActions() {
  const qc = useQueryClient();

  function update(
    id: string,
    patch: Partial<Conversation> | ((c: Conversation) => Partial<Conversation>),
  ) {
    qc.setQueryData<Conversation[]>(MOCK_INBOX_KEY, (prev) =>
      (prev ?? []).map((c) =>
        c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c,
      ),
    );
  }

  function markRead(id: string) {
    update(id, { unread: 0 });
  }

  function toggleAi(id: string, active: boolean) {
    update(id, { aiActive: active });
  }

  // Mesmo estado otimista de sempre: aparece na hora com "pendente", vira
  // "enviada" e depois "entregue" sozinha, sem nenhuma infra real por trás.
  function sendMessage(id: string, text: string) {
    const msgId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const message: Message = {
      id: msgId,
      direction: "out",
      type: "text",
      body: text,
      time: nowLabel(),
      status: "pending",
    };
    update(id, (c) => ({ messages: [...c.messages, message] }));
    const setStatus = (status: Message["status"]) =>
      update(id, (c) => ({
        messages: c.messages.map((m) => (m.id === msgId ? { ...m, status } : m)),
      }));
    setTimeout(() => setStatus("sent"), 500);
    setTimeout(() => setStatus("delivered"), 1400);
  }

  return { update, markRead, toggleAi, sendMessage };
}
