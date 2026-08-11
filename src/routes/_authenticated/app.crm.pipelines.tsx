import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  Loader2,
  Mail,
  Phone,
  User as UserIcon,
  Plus,
  ChevronDown,
  Pencil,
  Trash2,
  Search,
  Upload,
  Clock,
} from "lucide-react";
import { differenceInDays, differenceInHours } from "date-fns";
import { toast } from "sonner";
import {
  ensureDefaultPipeline,
  getBoard,
  moveCard,
  listPipelines,
  createPipeline,
  renamePipeline,
  deletePipeline,
  listMembers,
} from "@/lib/crm.functions";
import { tagColorClass } from "@/lib/crm-tag-color";
import { CardDetailDialog } from "@/components/crm/CardDetailDialog";
import { ImportContactsDialog } from "@/components/crm/ImportContactsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/crm/pipelines")({
  component: PipelinesPage,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <h2 className="font-bold text-destructive">Não foi possível carregar o pipeline</h2>
      <p className="mt-1 text-muted-foreground">{error?.message ?? "Erro inesperado."}</p>
      <Button size="sm" variant="outline" className="ck-btn mt-4" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </div>
  ),
});

type Card = {
  id: string;
  stageId: string;
  position: number;
  assigneeId: string | null;
  movedAt: string;
  tags: string[];
  lead: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    createdAt: string;
  };
};
type Stage = { id: string; name: string; color: string; order: number };

// Paleta de etiquetas da marca (docs/brand/design-system.md §2) — dessaturada,
// todos os pares com contraste >=4.6:1.
const STAGE_COLOR: Record<string, string> = {
  blue: "bg-[var(--ck-tag-azul-bg)] text-[var(--ck-tag-azul-fg)] border-transparent",
  amber: "bg-[var(--ck-tag-ambar-bg)] text-[var(--ck-tag-ambar-fg)] border-transparent",
  violet: "bg-[var(--ck-tag-roxo-bg)] text-[var(--ck-tag-roxo-fg)] border-transparent",
  cyan: "bg-[var(--ck-tag-petroleo-bg)] text-[var(--ck-tag-petroleo-fg)] border-transparent",
  emerald: "bg-[var(--ck-tag-verde-bg)] text-[var(--ck-tag-verde-fg)] border-transparent",
  rose: "bg-[var(--ck-tag-rosa-bg)] text-[var(--ck-tag-rosa-fg)] border-transparent",
  slate: "bg-[var(--ck-tag-ardosia-bg)] text-[var(--ck-tag-ardosia-fg)] border-transparent",
};

function PipelinesPage() {
  const qc = useQueryClient();
  const ensure = useServerFn(ensureDefaultPipeline);
  const fetchBoard = useServerFn(getBoard);
  const move = useServerFn(moveCard);
  const fetchPipelines = useServerFn(listPipelines);
  const createPipelineFn = useServerFn(createPipeline);
  const renamePipelineFn = useServerFn(renamePipeline);
  const deletePipelineFn = useServerFn(deletePipeline);

  const fetchMembers = useServerFn(listMembers);

  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const justDraggedRef = useRef(false);

  const boardKey = ["crm", "board", activePipelineId] as const;

  const { data, isLoading } = useQuery({
    queryKey: boardKey,
    queryFn: async () => {
      // Ensure default pipeline exists, then fetch board in single render cycle.
      try {
        await ensure();
      } catch {
        /* non-fatal */
      }
      return fetchBoard({ data: { pipelineId: activePipelineId ?? undefined } });
    },
  });

  const { data: pipelinesData } = useQuery({
    queryKey: ["crm", "pipelines"],
    queryFn: () => fetchPipelines(),
  });
  const pipelines = pipelinesData?.pipelines ?? [];
  const activePipeline =
    pipelines.find((p) => p.id === (activePipelineId ?? data?.pipelineId)) ?? pipelines[0];

  const moveMut = useMutation({
    mutationFn: (vars: { cardId: string; stageId: string; position: number }) =>
      move({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: boardKey });
      const prev = qc.getQueryData<{ stages: Stage[]; cards: Card[]; pipelineId: string | null }>(
        boardKey,
      );
      if (prev) {
        qc.setQueryData(boardKey, {
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === vars.cardId ? { ...c, stageId: vars.stageId, position: vars.position } : c,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey }),
  });

  const createMut = useMutation({
    mutationFn: (name: string) => createPipelineFn({ data: { name } }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      setActivePipelineId(result.pipelineId);
      setCreateOpen(false);
      setCreateName("");
      toast.success("Pipeline criado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível criar o pipeline."),
  });

  const renameMut = useMutation({
    mutationFn: (vars: { pipelineId: string; name: string }) => renamePipelineFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      setRenameOpen(false);
      toast.success("Pipeline renomeado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível renomear o pipeline."),
  });

  const deleteMut = useMutation({
    mutationFn: (pipelineId: string) => deletePipelineFn({ data: { pipelineId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "pipelines"] });
      setActivePipelineId(null);
      setDeleteOpen(false);
      toast.success("Pipeline excluído.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir o pipeline."),
  });

  const { data: membersData } = useQuery({
    queryKey: ["crm", "members"],
    queryFn: () => fetchMembers(),
  });
  const members = membersData?.members ?? [];
  const memberByUserId = useMemo(() => {
    const map = new Map<string, { email: string }>();
    members.forEach((m: { userId: string; email: string }) => map.set(m.userId, { email: m.email }));
    return map;
  }, [members]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    (data?.cards ?? []).forEach((c: Card) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [data]);

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.cards ?? []).filter((c: Card) => {
      if (q) {
        const hay =
          `${c.lead.name ?? ""} ${c.lead.email ?? ""} ${c.lead.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tagFilter !== "all" && !c.tags?.includes(tagFilter)) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "none" ? c.assigneeId : c.assigneeId !== assigneeFilter)
          return false;
      }
      return true;
    });
  }, [data, search, tagFilter, assigneeFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<string, Card[]>();
    (data?.stages ?? []).forEach((s: Stage) => map.set(s.id, []));
    filteredCards.forEach((c: Card) => {
      if (!map.has(c.stageId)) map.set(c.stageId, []);
      map.get(c.stageId)!.push(c);
    });
    return map;
  }, [data, filteredCards]);

  const activeCard = activeId ? (data?.cards ?? []).find((c: Card) => c.id === activeId) : null;

  function handleDragStart(e: DragStartEvent) {
    justDraggedRef.current = true;
    setActiveId(String(e.active.id));
  }

  function handleCardClick(cardId: string) {
    if (justDraggedRef.current) return;
    setSelectedCardId(cardId);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setTimeout(() => {
      justDraggedRef.current = false;
    }, 150);
    const { active, over } = e;
    if (!over) return;
    const cardId = String(active.id);
    const newStageId = String(over.id);
    const card = (data?.cards ?? []).find((c: Card) => c.id === cardId);
    if (!card || card.stageId === newStageId) return;
    const position = byStage.get(newStageId)?.length ?? 0;
    moveMut.mutate({ cardId, stageId: newStageId, position });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="ck-display text-3xl md:text-4xl tracking-tight text-foreground">
            Pipeline
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Arraste os cards entre as etapas para atualizar o status.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {pipelines.length > 0 && (
            <>
              <Select value={activePipeline?.id} onValueChange={(id) => setActivePipelineId(id)}>
                <SelectTrigger className="ck-input h-9 w-48">
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="ck-btn h-9 w-9 shrink-0">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setRenameName(activePipeline?.name ?? "");
                      setRenameOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Renomear
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!!activePipeline?.is_default}
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ck-btn"
            disabled={!activePipeline}
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" /> Importar contatos
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="ck-btn"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" /> Novo pipeline
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou telefone..."
            className="ck-input h-9 w-64 pl-8"
          />
        </div>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="ck-input h-9 w-40">
            <SelectValue placeholder="Etiqueta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etiquetas</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="ck-input h-9 w-44">
            <SelectValue placeholder="Atendente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os atendentes</SelectItem>
            <SelectItem value="none">Sem atendente</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || tagFilter !== "all" || assigneeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setSearch("");
              setTagFilter("all");
              setAssigneeFilter("all");
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo pipeline</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            className="ck-input"
            placeholder="Ex.: Implantes, Ortodontia..."
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && createName.trim() && createMut.mutate(createName.trim())
            }
          />
          <p className="text-xs text-muted-foreground">
            Já vem com as etapas padrão (Novos Leads, Em Atendimento, Agendou...) — dá pra ajustar
            depois.
          </p>
          <DialogFooter>
            <Button variant="outline" className="ck-btn" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="ck-btn"
              disabled={!createName.trim() || createMut.isPending}
              onClick={() => createMut.mutate(createName.trim())}
            >
              {createMut.isPending ? "Criando..." : "Criar pipeline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear pipeline</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            className="ck-input"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              renameName.trim() &&
              activePipeline &&
              renameMut.mutate({ pipelineId: activePipeline.id, name: renameName.trim() })
            }
          />
          <DialogFooter>
            <Button variant="outline" className="ck-btn" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="ck-btn"
              disabled={!renameName.trim() || renameMut.isPending}
              onClick={() =>
                activePipeline &&
                renameMut.mutate({ pipelineId: activePipeline.id, name: renameName.trim() })
              }
            >
              {renameMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{activePipeline?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir um pipeline sem cards. Mova os leads para outro pipeline antes,
              se houver algum aqui. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="ck-btn">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="ck-btn bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => activePipeline && deleteMut.mutate(activePipeline.id)}
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
          <div className="flex gap-4 min-w-full">
            {(data?.stages ?? []).map((stage: Stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                cards={byStage.get(stage.id) ?? []}
                isDropTarget={!!activeId && activeCard?.stageId !== stage.id}
                onCardClick={handleCardClick}
                memberByUserId={memberByUserId}
              />
            ))}
            <div className="w-1 shrink-0" /> {/* Extra space at the end of scroll */}
          </div>
        </div>
        <DragOverlay>
          {activeCard && (
            <CardItem card={activeCard} overlay memberByUserId={memberByUserId} />
          )}
        </DragOverlay>
      </DndContext>

      <CardDetailDialog
        cardId={selectedCardId}
        stages={data?.stages ?? []}
        onOpenChange={(open) => !open && setSelectedCardId(null)}
      />

      <ImportContactsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        pipelineId={activePipeline?.id}
        stages={data?.stages ?? []}
      />
    </div>
  );
}

function StageColumn({
  stage,
  cards,
  isDropTarget,
  onCardClick,
  memberByUserId,
}: {
  stage: Stage;
  cards: Card[];
  isDropTarget: boolean;
  onCardClick: (cardId: string) => void;
  memberByUserId: Map<string, { email: string }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={`ck-r-sig w-72 shrink-0 border border-border bg-secondary/40 p-3 transition ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-[var(--ck-r-flat-sm)] border px-2 py-0.5 text-xs font-semibold ${STAGE_COLOR[stage.color] ?? STAGE_COLOR.slate}`}
          >
            {stage.name}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{cards.length}</span>
        </div>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {cards.map((card) => (
          <CardItem
            key={card.id}
            card={card}
            onClick={() => onCardClick(card.id)}
            memberByUserId={memberByUserId}
          />
        ))}
        {/* Placeholder de destino: aparece só na coluna que vai receber o card
         * solto, sempre no fim da lista — a posição real que moveCard usa. */}
        {isDropTarget && (
          <div
            style={{ borderRadius: "var(--ck-r-flat)" }}
            className={`border-2 border-dashed h-14 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border/60"}`}
          />
        )}
        {cards.length === 0 && !isDropTarget && (
          <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border rounded-xl px-3">
            <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
              <UserIcon className="h-4 w-4 opacity-50" />
            </div>
            <p className="font-medium text-foreground/70">Nenhum lead aqui</p>
            <p className="mt-0.5 text-[11px]">Arraste cards de outras etapas</p>
          </div>
        )}
      </div>
    </div>
  );
}

// "há X dias/horas" desde a última troca de etapa, com destaque quando o
// card está parado há muito tempo (>7 dias âmbar, >14 dias vermelho — mesmo
// limiar que a Fase 4 do plano de CRM prevê para "leads parados").
function timeInStage(movedAt: string): { label: string; className: string } {
  const days = differenceInDays(new Date(), new Date(movedAt));
  if (days < 1) {
    const hours = Math.max(0, differenceInHours(new Date(), new Date(movedAt)));
    return { label: hours < 1 ? "agora" : `há ${hours}h`, className: "text-muted-foreground" };
  }
  const label = `há ${days}d`;
  if (days > 14) return { label, className: "text-destructive" };
  if (days > 7) return { label, className: "text-amber-600" };
  return { label, className: "text-muted-foreground" };
}

function CardItem({
  card,
  onClick,
  overlay,
  memberByUserId,
}: {
  card: Card;
  onClick?: () => void;
  overlay?: boolean;
  memberByUserId?: Map<string, { email: string }>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
  });
  const style =
    transform && !overlay
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
      : undefined;
  const assignee = card.assigneeId ? memberByUserId?.get(card.assigneeId) : undefined;
  const stage = timeInStage(card.movedAt);
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={overlay ? undefined : onClick}
      style={{ ...style, borderRadius: "var(--ck-r-flat)" }}
      className={`border border-border bg-background p-3 shadow-sm transition ${
        overlay
          ? "shadow-lg scale-105 cursor-grabbing"
          : `hover:shadow cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {(card.lead.name ?? card.lead.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{card.lead.name ?? "Sem nome"}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className={`h-3 w-3 shrink-0 ${stage.className}`} />
            <span className={stage.className}>{stage.label} na etapa</span>
            <span className="opacity-50">·</span>
            <span className="truncate">
              lead {new Date(card.lead.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
        </div>
        <div
          title={assignee ? assignee.email : "Sem atendente"}
          className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ${
            assignee
              ? "bg-secondary text-foreground/80"
              : "border border-dashed border-border text-muted-foreground/50"
          }`}
        >
          {assignee ? assignee.email.charAt(0).toUpperCase() : <UserIcon className="h-3 w-3" />}
        </div>
      </div>
      {(card.lead.email || card.lead.phone) && (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {card.lead.email && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-3 w-3 shrink-0" /> {card.lead.email}
            </div>
          )}
          {card.lead.phone && (
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="h-3 w-3 shrink-0" /> {card.lead.phone}
            </div>
          )}
        </div>
      )}
      {card.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.tags.map((t) => (
            <span
              key={t}
              style={{ borderRadius: "var(--ck-r-flat-sm)" }}
              className={`px-1.5 py-0.5 text-[10px] font-medium ${tagColorClass(t)}`}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
