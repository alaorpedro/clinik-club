import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { ConversationList, type InboxTab } from "@/components/crm/inbox/ConversationList";
import { ConversationHeader } from "@/components/crm/inbox/ConversationHeader";
import { MessageBubble } from "@/components/crm/inbox/MessageBubble";
import { Composer } from "@/components/crm/inbox/Composer";
import { SidePanel } from "@/components/crm/inbox/SidePanel";
import { matchMockConversation, type Conversation } from "@/lib/crm-inbox-mock";
import { useMockConversations, useMockConversationActions } from "@/hooks/use-mock-inbox";
import {
  getBoard,
  listMembers,
  getCardDetail,
  moveCard,
  assignCard,
  updateCardTags,
  addNote,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/app/crm/atendimento")({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: AtendimentoPage,
});

// Uma "entrada" do inbox = um card real do pipeline cujo lead casa com uma das
// personas do fixture mockado (ver matchMockConversation). Etapa, atendente e
// etiquetas vêm do card de verdade; só mensagens/IA/não-lidas seguem mockadas
// (Fase 3a) — compartilhadas com o modal do card via use-mock-inbox, pra dar
// pra atender tanto por aqui quanto pelo Pipeline.
function AtendimentoPage() {
  const { q } = Route.useSearch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchBoard = useServerFn(getBoard);
  const fetchMembers = useServerFn(listMembers);
  const fetchDetail = useServerFn(getCardDetail);
  const moveCardFn = useServerFn(moveCard);
  const assignFn = useServerFn(assignCard);
  const updateTagsFn = useServerFn(updateCardTags);
  const addNoteFn = useServerFn(addNote);

  const { data: board, isLoading } = useQuery({
    queryKey: ["crm", "board", undefined],
    queryFn: () => fetchBoard({ data: {} }),
  });
  const { data: membersData } = useQuery({
    queryKey: ["crm", "members"],
    queryFn: () => fetchMembers(),
  });
  const members = membersData?.members ?? [];

  const { data: mockConvos } = useMockConversations();
  const { sendMessage, toggleAi, markRead } = useMockConversationActions();

  const entries = useMemo(() => {
    return (board?.cards ?? [])
      .map((card: any) => {
        const matched = matchMockConversation(card.lead.name, card.lead.phone);
        if (!matched) return null;
        const live = mockConvos?.find((c) => c.id === matched.id);
        return {
          cardId: card.id as string,
          stageId: card.stageId as string,
          assigneeId: card.assigneeId as string | null,
          tags: card.tags as string[],
          lead: card.lead as { name: string | null; phone: string | null },
          mockId: matched.id,
          phone: card.lead.phone ?? matched.phone,
          channel: matched.channel,
          messages: live?.messages ?? matched.messages,
          aiActive: live?.aiActive ?? matched.aiActive,
          unread: live?.unread ?? matched.unread,
        };
      })
      .filter((e): e is NonNullable<typeof e> => !!e);
  }, [board, mockConvos]);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InboxTab>("novos");
  const [search, setSearch] = useState(q ?? "");

  // Seleção inicial só quando os dados chegam — vindo de ?q= (ex.: link "Ver
  // conversa" de outra tela), acha o lead correspondente e já abre na aba certa.
  useEffect(() => {
    if (selectedCardId !== null || entries.length === 0) return;
    const needle = q?.toLowerCase();
    const initialMatch = needle
      ? entries.find((e) => `${e.lead.name ?? ""} ${e.phone}`.toLowerCase().includes(needle))
      : undefined;
    const target = initialMatch ?? entries[0];
    setSelectedCardId(target.cardId);
    setActiveTab(
      target.assigneeId === null ? "novos" : target.assigneeId === user?.id ? "meus" : "outros",
    );
  }, [entries, q, selectedCardId, user?.id]);

  const selectedEntry = entries.find((e) => e.cardId === selectedCardId) ?? null;

  const { data: selectedDetail } = useQuery({
    queryKey: ["crm", "cardDetail", selectedCardId],
    queryFn: () => fetchDetail({ data: { cardId: selectedCardId! } }),
    enabled: !!selectedCardId,
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["crm"] });
  }

  const moveMut = useMutation({
    mutationFn: (stageId: string) =>
      moveCardFn({ data: { cardId: selectedCardId!, stageId, position: 0 } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível mudar a etapa."),
  });
  const assignMut = useMutation({
    mutationFn: (assigneeId: string | null) =>
      assignFn({ data: { cardId: selectedCardId!, assigneeId } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atribuir o atendimento."),
  });
  const tagsMut = useMutation({
    mutationFn: (tags: string[]) => updateTagsFn({ data: { cardId: selectedCardId!, tags } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar as etiquetas."),
  });
  const noteMut = useMutation({
    mutationFn: (body: string) => addNoteFn({ data: { cardId: selectedCardId!, body } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a nota."),
  });

  function selectConversation(cardId: string) {
    setSelectedCardId(cardId);
    const entry = entries.find((e) => e.cardId === cardId);
    if (entry) markRead(entry.mockId);
  }

  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [selectedEntry?.messages.length, selectedCardId]);

  const conversationsForList: Conversation[] = entries.map((e) => ({
    id: e.cardId,
    contactName: e.lead.name ?? "Sem nome",
    phone: e.phone,
    channel: e.channel,
    stageId: e.stageId,
    assigneeId: e.assigneeId,
    tags: e.tags,
    unread: e.unread,
    aiActive: e.aiActive,
    messages: e.messages,
    notes: [],
  }));

  const selectedConversation: Conversation | null = selectedEntry
    ? {
        id: selectedEntry.cardId,
        contactName: selectedEntry.lead.name ?? "Sem nome",
        phone: selectedEntry.phone,
        channel: selectedEntry.channel,
        stageId: selectedEntry.stageId,
        assigneeId: selectedEntry.assigneeId,
        tags: selectedEntry.tags,
        unread: selectedEntry.unread,
        aiActive: selectedEntry.aiActive,
        messages: selectedEntry.messages,
        notes: (selectedDetail?.notes ?? []).map((n: any) => ({
          id: n.id,
          body: n.body,
          time: new Date(n.created_at).toLocaleString("pt-BR"),
        })),
      }
    : null;

  const stagesForHeader = (board?.stages ?? []).map((s: any) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[520px] flex-col">
      <div className="mb-4">
        <h1 className="ck-display text-3xl md:text-4xl tracking-tight text-foreground">
          Atendimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leads do pipeline com conversa de WhatsApp. Etapa, atendente, etiquetas e notas já são
          reais — as mensagens ainda são um protótipo mockado (Fase 3a).
        </p>
      </div>

      <div className="ck-r-sig flex flex-1 overflow-x-auto overflow-y-hidden border border-border">
        <div className="flex min-w-[960px] flex-1">
          <ConversationList
            conversations={conversationsForList}
            selectedId={selectedCardId}
            onSelect={selectConversation}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            search={search}
            onSearchChange={setSearch}
            currentUserId={user?.id}
          />

          {selectedConversation && selectedEntry ? (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
                <ConversationHeader
                  conversation={selectedConversation}
                  stages={stagesForHeader}
                  members={members}
                  onStageChange={(stageId) => moveMut.mutate(stageId)}
                  onAssign={(assigneeId) => assignMut.mutate(assigneeId)}
                  onToggleAi={(active) => toggleAi(selectedEntry.mockId, active)}
                />
                <div ref={threadRef} className="ck-mesh-flat flex-1 space-y-2 overflow-y-auto p-4">
                  {selectedConversation.messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </div>
                <Composer onSend={(text) => sendMessage(selectedEntry.mockId, text)} />
              </div>
              <SidePanel
                conversation={selectedConversation}
                onUpdateTags={(tags) => tagsMut.mutate(tags)}
                onAddNote={(body) => noteMut.mutate(body)}
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p className="text-sm">
                {isLoading
                  ? "Carregando..."
                  : entries.length === 0
                    ? "Nenhum lead do pipeline tem conversa de WhatsApp ainda."
                    : "Selecione uma conversa para começar."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
