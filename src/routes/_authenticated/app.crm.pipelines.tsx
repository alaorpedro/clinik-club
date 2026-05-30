import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { Loader2, Mail, Phone, User as UserIcon, Plus } from "lucide-react";
import { ensureDefaultPipeline, getBoard, moveCard } from "@/lib/crm.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/crm/pipelines")({
  component: PipelinesPage,
});

type Card = {
  id: string;
  stageId: string;
  position: number;
  assigneeId: string | null;
  movedAt: string;
  lead: { id: string; name: string | null; email: string | null; phone: string | null; createdAt: string };
};
type Stage = { id: string; name: string; color: string; order: number };

const STAGE_COLOR: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  cyan: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  emerald: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  rose: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
};

function PipelinesPage() {
  const qc = useQueryClient();
  const ensure = useServerFn(ensureDefaultPipeline);
  const fetchBoard = useServerFn(getBoard);
  const move = useServerFn(moveCard);

  // Ensure default pipeline exists for new users
  useEffect(() => {
    ensure().then(() => qc.invalidateQueries({ queryKey: ["crm", "board"] })).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ["crm", "board"],
    queryFn: () => fetchBoard({ data: {} }),
  });

  const moveMut = useMutation({
    mutationFn: (vars: { cardId: string; stageId: string; position: number }) => move({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["crm", "board"] });
      const prev = qc.getQueryData<{ stages: Stage[]; cards: Card[]; pipelineId: string | null }>(["crm", "board"]);
      if (prev) {
        qc.setQueryData(["crm", "board"], {
          ...prev,
          cards: prev.cards.map((c) => (c.id === vars.cardId ? { ...c, stageId: vars.stageId, position: vars.position } : c)),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["crm", "board"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["crm", "board"] }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const byStage = useMemo(() => {
    const map = new Map<string, Card[]>();
    (data?.stages ?? []).forEach((s: Stage) => map.set(s.id, []));
    (data?.cards ?? []).forEach((c: Card) => {
      if (!map.has(c.stageId)) map.set(c.stageId, []);
      map.get(c.stageId)!.push(c);
    });
    return map;
  }, [data]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const cardId = String(active.id);
    const newStageId = String(over.id);
    const card = (data?.cards ?? []).find((c: Card) => c.id === cardId);
    if (!card || card.stageId === newStageId) return;
    const position = (byStage.get(newStageId)?.length ?? 0);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1 text-sm">Arraste os cards entre as etapas para atualizar o status.</p>
        </div>
        <Button variant="outline" size="sm" disabled className="rounded-full">
          <Plus className="h-4 w-4" /> Novo pipeline
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(data?.stages ?? []).map((stage: Stage) => (
            <StageColumn key={stage.id} stage={stage} cards={byStage.get(stage.id) ?? []} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function StageColumn({ stage, cards }: { stage: Stage; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-2xl border border-border bg-secondary/40 p-3 transition ${isOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STAGE_COLOR[stage.color] ?? STAGE_COLOR.slate}`}>
            {stage.name}
          </span>
          <span className="text-xs font-medium text-muted-foreground">{cards.length}</span>
        </div>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {cards.map((card) => (
          <CardItem key={card.id} card={card} />
        ))}
        {cards.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6 border border-dashed border-border rounded-xl">
            Vazio
          </div>
        )}
      </div>
    </div>
  );
}

function CardItem({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-xl border border-border bg-background p-3 shadow-sm hover:shadow transition cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
          {(card.lead.name ?? card.lead.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{card.lead.name ?? "Sem nome"}</div>
          <div className="text-xs text-muted-foreground truncate">
            {new Date(card.lead.createdAt).toLocaleDateString("pt-BR")}
          </div>
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
    </div>
  );
}