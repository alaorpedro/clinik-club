import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ConversationList, type InboxTab } from "@/components/crm/inbox/ConversationList";
import { ConversationHeader } from "@/components/crm/inbox/ConversationHeader";
import { MessageBubble } from "@/components/crm/inbox/MessageBubble";
import { Composer } from "@/components/crm/inbox/Composer";
import { SidePanel } from "@/components/crm/inbox/SidePanel";
import { CONVERSATIONS, type Conversation, type Message } from "@/lib/crm-inbox-mock";

export const Route = createFileRoute("/_authenticated/app/crm/atendimento")({
  component: AtendimentoPage,
});

function cloneConversations(): Conversation[] {
  return CONVERSATIONS.map((c) => ({
    ...c,
    tags: [...c.tags],
    messages: c.messages.map((m) => ({ ...m })),
    notes: c.notes.map((n) => ({ ...n })),
  }));
}

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AtendimentoPage() {
  const [conversations, setConversations] = useState<Conversation[]>(cloneConversations);
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<InboxTab>("novos");
  const [search, setSearch] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function updateSelected(patch: Partial<Conversation> | ((c: Conversation) => Partial<Conversation>)) {
    if (!selectedId) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c,
      ),
    );
  }

  function selectConversation(id: string) {
    setSelectedId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  // Estado otimista: a mensagem aparece na hora com relógio, vira "enviada" e
  // depois "entregue" sozinha — sem esperar nenhuma infra real (docs/brand/
  // design-system.md §4 marcava isso como pendência do CRM; decidido aqui).
  function sendMessage(text: string) {
    if (!selectedId) return;
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const message: Message = {
      id,
      direction: "out",
      type: "text",
      body: text,
      time: nowLabel(),
      status: "pending",
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedId ? { ...c, messages: [...c.messages, message] } : c)),
    );

    const setStatus = (status: Message["status"]) =>
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== selectedId
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)) },
        ),
      );

    timers.current.push(setTimeout(() => setStatus("sent"), 500));
    timers.current.push(setTimeout(() => setStatus("delivered"), 1400));
  }

  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [selected?.messages.length, selectedId]);

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[520px] flex-col">
      <div className="mb-4">
        <h1 className="ck-display text-3xl md:text-4xl tracking-tight text-foreground">
          Atendimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Protótipo mockado — dados de exemplo, sem conexão real de WhatsApp ainda.
        </p>
      </div>

      <div className="ck-r-sig flex flex-1 overflow-hidden border border-border">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={selectConversation}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          search={search}
          onSearchChange={setSearch}
        />

        {selected ? (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              <ConversationHeader
                conversation={selected}
                onStageChange={(stageId) => updateSelected({ stageId })}
                onAssign={(assigneeId) => updateSelected({ assigneeId })}
                onToggleAi={(aiActive) => updateSelected({ aiActive })}
              />
              <div ref={threadRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {selected.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </div>
              <Composer onSend={sendMessage} />
            </div>
            <SidePanel
              conversation={selected}
              onUpdateTags={(tags) => updateSelected({ tags })}
              onAddNote={(body) =>
                updateSelected((c) => ({
                  notes: [...c.notes, { id: `note-${Date.now()}`, body, time: "agora" }],
                }))
              }
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="h-8 w-8 opacity-40" />
            <p className="text-sm">Selecione uma conversa para começar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
