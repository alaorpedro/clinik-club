import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, UserPlus, CalendarClock } from "lucide-react";
import { BrandLoader } from "@/components/ui/brand-loader";
import { toast } from "sonner";
import {
  ensureDefaultPipeline,
  getBoard,
  listPipelines,
  createStage,
  renameStage,
  reorderStages,
  deleteStage,
  setStageSchedulingFlag,
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from "@/lib/crm.functions";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/crm/configuracoes")({
  component: SettingsPage,
});

type Stage = {
  id: string;
  name: string;
  color: string;
  order: number;
  triggersScheduling?: boolean;
};

// Mesma paleta usada no kanban (app.crm.pipelines.tsx) — sete cores curadas
// pra etapa, diferente da paleta de dez cores por hash das etiquetas.
const STAGE_COLORS: { key: string; swatch: string }[] = [
  { key: "blue", swatch: "bg-[var(--ck-tag-azul-fg)]" },
  { key: "amber", swatch: "bg-[var(--ck-tag-ambar-fg)]" },
  { key: "violet", swatch: "bg-[var(--ck-tag-roxo-fg)]" },
  { key: "cyan", swatch: "bg-[var(--ck-tag-petroleo-fg)]" },
  { key: "emerald", swatch: "bg-[var(--ck-tag-verde-fg)]" },
  { key: "rose", swatch: "bg-[var(--ck-tag-rosa-fg)]" },
  { key: "slate", swatch: "bg-[var(--ck-tag-ardosia-fg)]" },
];

function SettingsPage() {
  const qc = useQueryClient();
  const ensure = useServerFn(ensureDefaultPipeline);
  const fetchBoard = useServerFn(getBoard);
  const fetchPipelines = useServerFn(listPipelines);
  const createStageFn = useServerFn(createStage);
  const renameStageFn = useServerFn(renameStage);
  const reorderStagesFn = useServerFn(reorderStages);
  const deleteStageFn = useServerFn(deleteStage);
  const schedulingFlagFn = useServerFn(setStageSchedulingFlag);
  const fetchMembers = useServerFn(listMembers);
  const inviteMemberFn = useServerFn(inviteMember);
  const updateMemberRoleFn = useServerFn(updateMemberRole);
  const removeMemberFn = useServerFn(removeMember);

  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState("blue");
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");

  const boardKey = ["crm", "board", activePipelineId] as const;

  const { data, isLoading } = useQuery({
    queryKey: boardKey,
    queryFn: async () => {
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
  const stages: Stage[] = data?.stages ?? [];

  const createMut = useMutation({
    mutationFn: (vars: { name: string; color: string }) =>
      createStageFn({
        data: { pipelineId: activePipeline!.id, name: vars.name, color: vars.color },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKey });
      setCreateOpen(false);
      setCreateName("");
      setCreateColor("blue");
      toast.success("Etapa criada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível criar a etapa."),
  });

  const renameMut = useMutation({
    mutationFn: (vars: { stageId: string; name: string; color?: string }) =>
      renameStageFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a etapa."),
  });

  const reorderMut = useMutation({
    mutationFn: (orderedStageIds: string[]) =>
      reorderStagesFn({ data: { pipelineId: activePipeline!.id, orderedStageIds } }),
    onMutate: async (orderedStageIds) => {
      await qc.cancelQueries({ queryKey: boardKey });
      const prev = qc.getQueryData<typeof data>(boardKey);
      if (prev) {
        const byId = new Map<string, any>(prev.stages.map((s: any) => [s.id, s]));
        qc.setQueryData(boardKey, {
          ...prev,
          stages: orderedStageIds.map((id, i) => ({ ...byId.get(id), order: i })),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boardKey, ctx.prev);
      toast.error("Não foi possível reordenar as etapas.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: boardKey }),
  });

  const deleteMut = useMutation({
    mutationFn: (stageId: string) => deleteStageFn({ data: { stageId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKey });
      setDeleteTarget(null);
      toast.success("Etapa excluída.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível excluir a etapa."),
  });

  const schedulingMut = useMutation({
    mutationFn: (vars: { stageId: string; triggersScheduling: boolean }) =>
      schedulingFlagFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: boardKey }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar a etapa."),
  });

  const { data: membersData } = useQuery({
    queryKey: ["crm", "members"],
    queryFn: () => fetchMembers(),
  });
  const members = membersData?.members ?? [];

  const inviteMut = useMutation({
    mutationFn: (vars: { email: string; role: "admin" | "agent" }) =>
      inviteMemberFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "members"] });
      setInviteEmail("");
      setInviteRole("agent");
      toast.success("Atendente adicionado à equipe.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível convidar."),
  });

  const roleMut = useMutation({
    mutationFn: (vars: { memberId: string; role: "admin" | "agent" }) =>
      updateMemberRoleFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "members"] }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar o papel."),
  });

  const removeMut = useMutation({
    mutationFn: (memberId: string) => removeMemberFn({ data: { memberId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "members"] });
      toast.success("Atendente removido.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover."),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(stages, oldIndex, newIndex);
    reorderMut.mutate(reordered.map((s) => s.id));
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="ck-display text-4xl tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Etapas do pipeline e equipe de atendimento.
          </p>
        </div>
      </div>

      <p className="ck-eyebrow mb-3">Etapas</p>
      <div className="mb-8 max-w-xl">
        {!!stages.length && !stages.some((s) => s.triggersScheduling) && (
          <div className="ck-r-flat mb-3 flex items-center gap-2 border border-[var(--ck-warning)]/30 bg-[var(--ck-warning-bg)] px-3 py-2 text-xs text-[var(--ck-warning)]">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <p>
              Nenhuma etapa deste pipeline dispara o agendamento — clique no ícone de calendário
              de uma etapa abaixo para marcar.
            </p>
          </div>
        )}
        {pipelines.length > 0 && (
          <Select value={activePipeline?.id} onValueChange={(id) => setActivePipelineId(id)}>
            <SelectTrigger className="ck-input h-9 w-48 mb-3">
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
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <BrandLoader className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="ck-r-sig border border-border bg-card p-4">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {stages.map((stage) => (
                    <StageRow
                      key={stage.id}
                      stage={stage}
                      onRename={(name) => renameMut.mutate({ stageId: stage.id, name })}
                      onColor={(color) =>
                        renameMut.mutate({ stageId: stage.id, name: stage.name, color })
                      }
                      onDelete={() => setDeleteTarget(stage)}
                      onToggleScheduling={() =>
                        schedulingMut.mutate({
                          stageId: stage.id,
                          triggersScheduling: !stage.triggersScheduling,
                        })
                      }
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button
              variant="outline"
              size="sm"
              className="ck-btn mt-4 w-full"
              disabled={!activePipeline}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" /> Nova etapa
            </Button>
          </div>
        )}
      </div>

      <p className="ck-eyebrow mb-3">Equipe</p>
      <div className="ck-r-sig border border-border bg-card p-4 max-w-xl">
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.memberId ?? m.userId}
              className="ck-r-flat flex items-center gap-2 border border-border bg-background p-2"
            >
              <div className="min-w-0 flex-1 text-sm truncate">{m.email}</div>
              {m.role === "owner" ? (
                <span className="text-xs text-muted-foreground px-2">Dono da conta</span>
              ) : (
                <>
                  <Select
                    value={m.role}
                    onValueChange={(role) =>
                      roleMut.mutate({ memberId: m.memberId!, role: role as "admin" | "agent" })
                    }
                  >
                    <SelectTrigger className="ck-input h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Atendente</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMut.mutate(m.memberId!)}
                    aria-label="Remover atendente"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@daclinica.com"
            className="ck-input h-9 flex-1"
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "agent")}>
            <SelectTrigger className="ck-input h-9 w-36 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Atendente</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="ck-btn shrink-0"
            disabled={!inviteEmail.trim() || inviteMut.isPending}
            onClick={() => inviteMut.mutate({ email: inviteEmail.trim(), role: inviteRole })}
          >
            <UserPlus className="h-4 w-4" /> {inviteMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          A pessoa precisa já ter uma conta na Clinik.Club — convite por email chega numa próxima
          versão.
        </p>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova etapa</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            className="ck-input"
            placeholder="Ex.: Aguardando retorno"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <div className="flex items-center gap-2">
            {STAGE_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.key}
                onClick={() => setCreateColor(c.key)}
                className={`h-6 w-6 rounded-full ${c.swatch} transition ${
                  createColor === c.key
                    ? "ring-2 ring-offset-2 ring-foreground"
                    : "opacity-50 hover:opacity-80"
                }`}
              />
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" className="ck-btn" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="ck-btn"
              disabled={!createName.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name: createName.trim(), color: createColor })}
            >
              {createMut.isPending ? "Criando..." : "Criar etapa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir uma etapa sem cards. Mova os leads para outra etapa antes, se
              houver algum aqui. Essa ação não pode ser desfeita.
              {deleteTarget?.triggersScheduling && (
                <span className="mt-2 block font-medium text-amber-600">
                  Essa é a etapa que dispara o agendamento automático. Ao excluir, nenhuma etapa vai
                  abrir o modal de agendamento até você marcar outra.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="ck-btn">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="ck-btn bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StageRow({
  stage,
  onRename,
  onColor,
  onDelete,
  onToggleScheduling,
}: {
  stage: Stage;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onDelete: () => void;
  onToggleScheduling: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });
  const [name, setName] = useState(stage.name);
  const style = { transform: CSS.Transform.toString(transform), transition };
  const activeSwatch = STAGE_COLORS.find((c) => c.key === stage.color) ?? STAGE_COLORS[6];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ck-r-flat flex items-center gap-2 border border-border bg-background p-2 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0"
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {STAGE_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.key}
            onClick={() => onColor(c.key)}
            className={`h-4 w-4 rounded-full ${c.swatch} transition ${
              c.key === activeSwatch.key
                ? "ring-2 ring-offset-1 ring-foreground"
                : "opacity-30 hover:opacity-70"
            }`}
          />
        ))}
      </div>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== stage.name && onRename(name.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="ck-input h-8 flex-1 min-w-0"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleScheduling}
        aria-label={
          stage.triggersScheduling
            ? "Desativar disparo de agendamento"
            : "Ativar disparo de agendamento nesta etapa"
        }
        title={
          stage.triggersScheduling
            ? "Essa etapa dispara o modal de agendamento"
            : "Marcar esta etapa como a que dispara o agendamento"
        }
        className={`h-8 w-8 shrink-0 ${
          stage.triggersScheduling
            ? "text-primary hover:text-primary"
            : "text-muted-foreground/40 hover:text-muted-foreground"
        }`}
      >
        <CalendarClock className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label="Excluir etapa"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
