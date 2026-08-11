import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  Phone,
  UserRound,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAppointments,
  listMembers,
  listClosedDates,
  setDateClosed,
  getBoard,
} from "@/lib/crm.functions";
import { CardDetailDialog } from "@/components/crm/CardDetailDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/crm/agenda")({
  component: AgendaPage,
});

const STAGE_COLOR: Record<string, string> = {
  blue: "bg-[var(--ck-tag-azul-bg)] text-[var(--ck-tag-azul-fg)] border-transparent",
  amber: "bg-[var(--ck-tag-ambar-bg)] text-[var(--ck-tag-ambar-fg)] border-transparent",
  violet: "bg-[var(--ck-tag-roxo-bg)] text-[var(--ck-tag-roxo-fg)] border-transparent",
  cyan: "bg-[var(--ck-tag-petroleo-bg)] text-[var(--ck-tag-petroleo-fg)] border-transparent",
  emerald: "bg-[var(--ck-tag-verde-bg)] text-[var(--ck-tag-verde-fg)] border-transparent",
  rose: "bg-[var(--ck-tag-rosa-bg)] text-[var(--ck-tag-rosa-fg)] border-transparent",
  slate: "bg-[var(--ck-tag-ardosia-bg)] text-[var(--ck-tag-ardosia-fg)] border-transparent",
};

type Appointment = {
  id: string;
  scheduledAt: string;
  evaluatorId: string | null;
  cardId: string;
  pipelineId: string;
  pipelineName: string;
  stageName: string;
  stageColor: string;
  lead: { name: string | null; phone: string | null; email: string | null };
};

const dayKey = (d: Date) => format(d, "yyyy-MM-dd");

function AppointmentRow({
  appt,
  evaluatorEmail,
  onClick,
}: {
  appt: Appointment;
  evaluatorEmail: string | undefined;
  onClick: () => void;
}) {
  const when = new Date(appt.scheduledAt);
  return (
    <button
      type="button"
      onClick={onClick}
      className="ck-r-flat flex w-full items-center gap-4 border border-border bg-background p-3 text-left transition hover:shadow cursor-pointer"
    >
      <div className="w-14 shrink-0 text-center">
        <p className="ck-display text-xl leading-none">
          {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{appt.lead.name ?? "Sem nome"}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {appt.lead.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {appt.lead.phone}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" /> {evaluatorEmail ?? "avaliador a definir"}
          </span>
          <span>{appt.pipelineName}</span>
        </div>
      </div>
      <span
        className={`inline-flex shrink-0 items-center rounded-[var(--ck-r-flat-sm)] border px-2 py-0.5 text-xs font-semibold ${STAGE_COLOR[appt.stageColor] ?? STAGE_COLOR.slate}`}
      >
        {appt.stageName}
      </span>
    </button>
  );
}

function AgendaPage() {
  const qc = useQueryClient();
  const fetchAppointments = useServerFn(listAppointments);
  const fetchMembers = useServerFn(listMembers);
  const fetchClosedDates = useServerFn(listClosedDates);
  const setClosedFn = useServerFn(setDateClosed);
  const fetchBoard = useServerFn(getBoard);

  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [dayPanel, setDayPanel] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [selected, setSelected] = useState<{ cardId: string; pipelineId: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["crm", "appointments"],
    queryFn: () => fetchAppointments(),
  });
  const { data: membersData } = useQuery({
    queryKey: ["crm", "members"],
    queryFn: () => fetchMembers(),
  });
  const members = membersData?.members ?? [];

  const { data: closedData } = useQuery({
    queryKey: ["crm", "closedDates"],
    queryFn: () => fetchClosedDates(),
  });
  const closedByDate = useMemo(() => {
    const map = new Map<string, { reason: string | null }>();
    (closedData?.closedDates ?? []).forEach((c: { date: string; reason: string | null }) =>
      map.set(c.date, { reason: c.reason }),
    );
    return map;
  }, [closedData]);

  const { data: selectedBoard } = useQuery({
    queryKey: ["crm", "board", selected?.pipelineId],
    queryFn: () => fetchBoard({ data: { pipelineId: selected!.pipelineId } }),
    enabled: !!selected,
  });

  const closeMut = useMutation({
    mutationFn: (vars: { date: string; closed: boolean; reason?: string | null }) =>
      setClosedFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "closedDates"] });
      setCloseReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar o dia."),
  });

  const appointments: Appointment[] = data?.appointments ?? [];
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const key = dayKey(new Date(a.scheduledAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [appointments]);

  function evaluatorEmailFor(id: string | null) {
    return id ? members.find((m) => m.userId === id)?.email : undefined;
  }

  const gridStart = startOfWeek(startOfMonth(monthCursor), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(monthCursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const panelDate = dayPanel ? new Date(`${dayPanel}T00:00:00`) : null;
  const panelAppointments = dayPanel ? (byDate.get(dayPanel) ?? []) : [];
  const panelClosed = dayPanel ? closedByDate.get(dayPanel) : undefined;

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
          <h1 className="ck-display text-3xl md:text-4xl tracking-tight text-foreground">Agenda</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Leads com avaliação marcada. Clique num dia pra ver os detalhes ou fechar a agenda
            daquela data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="ck-btn h-9 w-9"
            onClick={() => setMonthCursor((m) => subMonths(m, 1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="ck-display w-40 text-center text-lg capitalize">
            {format(monthCursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <Button
            variant="outline"
            size="icon"
            className="ck-btn h-9 w-9"
            onClick={() => setMonthCursor((m) => addMonths(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="ck-r-sig max-w-4xl border border-border bg-card p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayLabels.map((w) => (
            <div key={w} className="py-1 text-center text-xs font-semibold text-muted-foreground">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = dayKey(d);
            const inMonth = isSameMonth(d, monthCursor);
            const closed = closedByDate.has(key);
            const dayAppts = byDate.get(key) ?? [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDayPanel(key)}
                className={`ck-r-flat flex min-h-[76px] flex-col items-start gap-1 border p-1.5 text-left transition ${
                  inMonth ? "border-border bg-background" : "border-transparent bg-transparent opacity-40"
                } ${closed ? "bg-secondary/60" : ""} hover:border-primary/40`}
              >
                <span
                  className={`text-xs font-medium ${
                    isToday(d) ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground/80"
                  }`}
                >
                  {format(d, "d")}
                </span>
                {closed && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" /> Fechado
                  </span>
                )}
                {dayAppts.length > 0 && (
                  <span className="mt-auto inline-flex items-center rounded-[var(--ck-r-flat-sm)] bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {dayAppts.length} agendado{dayAppts.length > 1 ? "s" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!dayPanel} onOpenChange={(open) => !open && setDayPanel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {panelDate && format(panelDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>

          <div className="ck-r-flat flex items-center justify-between gap-3 border border-border bg-secondary/40 p-3">
            {panelClosed ? (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground/90">
                  <Lock className="h-3.5 w-3.5" /> Agenda fechada neste dia
                </p>
                {panelClosed.reason && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{panelClosed.reason}</p>
                )}
              </div>
            ) : (
              <Input
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                placeholder="Motivo (opcional)..."
                className="ck-input h-8 flex-1 text-xs"
              />
            )}
            <Button
              variant="outline"
              size="sm"
              className="ck-btn shrink-0"
              disabled={closeMut.isPending}
              onClick={() =>
                dayPanel &&
                closeMut.mutate({
                  date: dayPanel,
                  closed: !panelClosed,
                  reason: panelClosed ? undefined : closeReason,
                })
              }
            >
              {panelClosed ? (
                <>
                  <LockOpen className="h-3.5 w-3.5" /> Reabrir dia
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" /> Fechar dia
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {panelAppointments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum agendamento neste dia.
              </p>
            )}
            {panelAppointments
              .slice()
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
              .map((a) => (
                <AppointmentRow
                  key={a.id}
                  appt={a}
                  evaluatorEmail={evaluatorEmailFor(a.evaluatorId)}
                  onClick={() => setSelected({ cardId: a.cardId, pipelineId: a.pipelineId })}
                />
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <CardDetailDialog
        cardId={selected?.cardId ?? null}
        stages={selectedBoard?.stages ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
