import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  getCardDetail,
  addNote,
  updateCardTags,
  assignCard,
  listMembers,
} from "@/lib/crm.functions";
import { tagColorClass } from "@/lib/crm-tag-color";
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

  const [noteBody, setNoteBody] = useState("");
  const [tagInput, setTagInput] = useState("");

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

  const card = data?.card as any;
  const tags: string[] = card?.tags ?? [];

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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card?.leads?.name ?? "Lead sem nome"}</DialogTitle>
        </DialogHeader>

        {isLoading || !card ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
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
        )}
      </DialogContent>
    </Dialog>
  );
}
