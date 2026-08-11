import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Mail,
  Phone,
  X,
  Send,
  ArrowRightLeft,
  Tag as TagIcon,
  UserRound,
  MessageSquareOff,
  Wifi,
  Compass,
  Megaphone,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import {
  getCardDetail,
  addNote,
  updateCardTags,
  assignCard,
  moveCard,
  listMembers,
} from "@/lib/crm.functions";
import { tagColorClass } from "@/lib/crm-tag-color";
import { CONVERSATIONS, type Conversation, type Message } from "@/lib/crm-inbox-mock";
import { MessageBubble } from "@/components/crm/inbox/MessageBubble";
import { Composer } from "@/components/crm/inbox/Composer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Stage = { id: string; name: string; color: string };

function findMockConversation(name: string | null, phone: string | null): Conversation | null {
  const needle = `${name ?? ""} ${phone ?? ""}`.trim().toLowerCase();
  if (!needle) return null;
  const hit = CONVERSATIONS.find((c) =>
    `${c.contactName} ${c.phone}`.toLowerCase().includes(needle) ||
    needle.includes(c.contactName.toLowerCase()),
  );
  if (!hit) return null;
  return { ...hit, tags: [...hit.tags], messages: hit.messages.map((m) => ({ ...m })), notes: [...hit.notes] };
}

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function CardDetailDialog({
  cardId,
  stages,
  onOpenChange,
}: {
  cardId: string | null;
  stages: Stage[];
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getCardDetail);
  const fetchMembers = useServerFn(listMembers);
  const addNoteFn = useServerFn(addNote);
  const updateTagsFn = useServerFn(updateCardTags);
  const assignFn = useServerFn(assignCard);
  const moveCardFn = useServerFn(moveCard);

  const [noteBody, setNoteBody] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [convo, setConvo] = useState<Conversation | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const { data, isLoading } = useQuery({
    queryKey: ["crm", "cardDetail", cardId],
    queryFn: () => fetchDetail({ data: { cardId: cardId! } }),
    enabled: !!cardId,
  });

  const { data: membersData } = useQuery({
    queryKey: ["crm", "members"],
    queryFn: () => fetchMembers(),
    enabled: !!cardId,
  });
  const members = membersData?.members ?? [];

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["crm"] });
  }

  const noteMut = useMutation({
    mutationFn: (body: string) => addNoteFn({ data: { cardId: cardId!, body } }),
    onSuccess: () => {
      setNoteBody("");
      invalidateAll();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a nota."),
  });

  const tagsMut = useMutation({
    mutationFn: (tags: string[]) => updateTagsFn({ data: { cardId: cardId!, tags } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar as etiquetas."),
  });

  const assignMut = useMutation({
    mutationFn: (assigneeId: string | null) => assignFn({ data: { cardId: cardId!, assigneeId } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atribuir o card."),
  });

  const moveMut = useMutation({
    mutationFn: (stageId: string) => moveCardFn({ data: { cardId: cardId!, stageId, position: 0 } }),
    onSuccess: invalidateAll,
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível mudar a etapa."),
  });

  const card = data?.card as any;
  const tags: string[] = card?.tags ?? [];
  const origin = data?.origin as
    | { funnelName: string | null; answers: Array<{ question: string; answer: string }> }
    | undefined;
  const utm = (card?.leads?.utm ?? {}) as Record<string, string>;
  const utmSource = utm.utm_source ?? utm.source;
  const utmCampaign = utm.utm_campaign ?? utm.campaign;
  const utmMedium = utm.utm_medium ?? utm.medium;
  const hasCampaign = !!(utmSource || utmCampaign || utmMedium);

  // Liga com a conversa mockada da Fase 3a por nome/telefone — leads reais de
  // teste não têm par nenhum ainda, é o esperado até a integração de verdade
  // (Fase 3b). Cada card abre com sua própria cópia local, sem sincronizar
  // com a página de Atendimento.
  useEffect(() => {
    if (!card) return;
    setConvo(findMockConversation(card.leads?.name ?? null, card.leads?.phone ?? null));
  }, [cardId, card?.leads?.name, card?.leads?.phone]);

  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [convo?.messages.length]);

  function sendConvoMessage(text: string) {
    if (!convo) return;
    const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const message: Message = { id, direction: "out", type: "text", body: text, time: nowLabel(), status: "pending" };
    setConvo((c) => (c ? { ...c, messages: [...c.messages, message] } : c));
    const setStatus = (status: Message["status"]) =>
      setConvo((c) =>
        c ? { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, status } : m)) } : c,
      );
    timers.current.push(setTimeout(() => setStatus("sent"), 500));
    timers.current.push(setTimeout(() => setStatus("delivered"), 1400));
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagInput("");
      return;
    }
    tagsMut.mutate([...tags, t]);
    setTagInput("");
  }

  function removeTag(t: string) {
    tagsMut.mutate(tags.filter((x) => x !== t));
  }

  function eventLabel(ev: { type: string; payload: any }) {
    if (ev.type === "stage_changed") {
      const to = stages.find((s) => s.id === ev.payload?.toStageId)?.name ?? "outra etapa";
      const from = stages.find((s) => s.id === ev.payload?.fromStageId)?.name;
      return from ? `Moveu de "${from}" para "${to}"` : `Entrou em "${to}"`;
    }
    if (ev.type === "assigned") {
      const who = members.find((m) => m.userId === ev.payload?.assigneeId)?.email;
      return ev.payload?.assigneeId ? `Atribuído para ${who ?? "alguém"}` : "Atribuição removida";
    }
    if (ev.type === "tags_changed") {
      const t = ev.payload?.tags as string[] | undefined;
      return t?.length ? `Etiquetas: ${t.join(", ")}` : "Etiquetas removidas";
    }
    return ev.type;
  }

  return (
    <Dialog open={!!cardId} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border py-4 pl-6 pr-12">
          <div className="flex flex-wrap items-center gap-3">
            <DialogTitle className="mr-auto">{card?.leads?.name ?? "Lead sem nome"}</DialogTitle>
            {!isLoading && card && (
              <Select value={card.stage_id} onValueChange={(v) => moveMut.mutate(v)}>
                <SelectTrigger className="ck-input h-8 w-48 text-xs">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </DialogHeader>

        {isLoading || !card ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 md:grid-cols-2">
            <div className="space-y-6 overflow-y-auto border-r border-border p-6">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {card.leads.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {card.leads.email}
                  </span>
                )}
                {card.leads.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {card.leads.phone}
                  </span>
                )}
              </div>

              {/* Origem: funil e campanha */}
              {(origin?.funnelName || hasCampaign) && (
                <div>
                  <p className="ck-eyebrow mb-2 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5" /> Origem
                  </p>
                  <div className="space-y-1 text-sm">
                    {origin?.funnelName && (
                      <p className="text-foreground/80">
                        Funil: <span className="font-medium">{origin.funnelName}</span>
                      </p>
                    )}
                    {hasCampaign ? (
                      <p className="flex items-start gap-1.5 text-foreground/80">
                        <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {[utmSource, utmMedium, utmCampaign].filter(Boolean).join(" · ")}
                        </span>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Sem dados de campanha (lead não veio com parâmetros de UTM na URL).
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Respostas do funil */}
              {!!origin?.answers?.length && (
                <div>
                  <p className="ck-eyebrow mb-2 flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5" /> Respostas do funil
                  </p>
                  <div className="space-y-2">
                    {origin.answers.map((a, i) => (
                      <div
                        key={i}
                        className="ck-r-flat border border-border bg-secondary/40 p-2.5 text-sm"
                      >
                        <p className="text-xs font-medium text-muted-foreground">{a.question}</p>
                        <p className="mt-0.5 text-foreground/90">{a.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Atendente */}
              <div>
                <p className="ck-eyebrow mb-2 flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" /> Atendente
                </p>
                <Select
                  value={card.assignee_id ?? "none"}
                  onValueChange={(v) => assignMut.mutate(v === "none" ? null : v)}
                >
                  <SelectTrigger className="ck-input h-9 w-64">
                    <SelectValue placeholder="Ninguém atribuído" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém atribuído</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Etiquetas */}
              <div>
                <p className="ck-eyebrow mb-2 flex items-center gap-1.5">
                  <TagIcon className="h-3.5 w-3.5" /> Etiquetas
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      style={{ borderRadius: "var(--ck-r-flat-sm)" }}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${tagColorClass(t)}`}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="opacity-60 hover:opacity-100 cursor-pointer"
                        aria-label={`Remover etiqueta ${t}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Nova etiqueta..."
                    className="ck-input h-8 w-36 text-xs"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <p className="ck-eyebrow mb-2">Notas</p>
                <div className="space-y-2">
                  <Textarea
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Escreva uma nota sobre este lead..."
                    rows={2}
                    className="ck-input"
                  />
                  <Button
                    size="sm"
                    className="ck-btn"
                    disabled={!noteBody.trim() || noteMut.isPending}
                    onClick={() => noteMut.mutate(noteBody.trim())}
                  >
                    <Send className="h-3.5 w-3.5" /> Salvar nota
                  </Button>
                </div>
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {(data?.notes ?? []).map((n: any) => (
                    <div
                      key={n.id}
                      className="ck-r-flat border border-border bg-secondary/40 p-3 text-sm"
                    >
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                  {!(data?.notes ?? []).length && (
                    <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="ck-eyebrow mb-2 flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Histórico
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(data?.events ?? []).map((ev: any) => (
                    <div key={ev.id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="text-foreground/80">{eventLabel(ev)}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {new Date(ev.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  ))}
                  {!(data?.events ?? []).length && (
                    <p className="text-xs text-muted-foreground">Sem eventos registrados ainda.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Conversa (mock da Fase 3a — só leads de exemplo têm par) */}
            <div className="flex min-h-0 flex-col">
              {convo ? (
                <>
                  <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-4 py-3 text-xs text-muted-foreground">
                    <Wifi className="h-3 w-3 text-emerald-600" /> {convo.channel} · {convo.phone}
                  </div>
                  <div ref={threadRef} className="ck-mesh-flat flex-1 space-y-2 overflow-y-auto p-4">
                    {convo.messages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))}
                  </div>
                  <Composer onSend={sendConvoMessage} />
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <MessageSquareOff className="h-8 w-8 text-muted-foreground opacity-40" />
                  <p className="text-sm font-medium text-foreground/70">Sem conversa de WhatsApp ainda</p>
                  <p className="max-w-[240px] text-xs text-muted-foreground">
                    A integração real de WhatsApp chega na Fase 3b — por enquanto só os leads de
                    exemplo do protótipo têm conversa aqui.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
