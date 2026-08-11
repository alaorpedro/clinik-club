import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, CalendarClock, Phone, UserRound } from "lucide-react";
import { listAppointments, listMembers, getBoard } from "@/lib/crm.functions";
import { CardDetailDialog } from "@/components/crm/CardDetailDialog";

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
      <div className="w-20 shrink-0 text-center">
        <p className="text-xs font-medium text-muted-foreground">
          {when.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
        </p>
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
  const fetchAppointments = useServerFn(listAppointments);
  const fetchMembers = useServerFn(listMembers);
  const fetchBoard = useServerFn(getBoard);

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

  const { data: selectedBoard } = useQuery({
    queryKey: ["crm", "board", selected?.pipelineId],
    queryFn: () => fetchBoard({ data: { pipelineId: selected!.pipelineId } }),
    enabled: !!selected,
  });

  const appointments: Appointment[] = data?.appointments ?? [];
  const now = Date.now();
  const upcoming = appointments.filter((a) => new Date(a.scheduledAt).getTime() >= now);
  const past = appointments
    .filter((a) => new Date(a.scheduledAt).getTime() < now)
    .slice()
    .reverse();

  function evaluatorEmailFor(id: string | null) {
    return id ? members.find((m) => m.userId === id)?.email : undefined;
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
      <div className="mb-6">
        <h1 className="ck-display text-3xl md:text-4xl tracking-tight text-foreground">Agenda</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Leads com avaliação marcada — vem de qualquer etapa marcada como "dispara agendamento"
          em Configurações.
        </p>
      </div>

      <div className="max-w-2xl space-y-2">
        {upcoming.length === 0 && (
          <div className="ck-r-sig border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <CalendarClock className="mx-auto mb-2 h-6 w-6 opacity-40" />
            Nenhuma avaliação marcada ainda. Mova um lead para a etapa de agendamento no pipeline
            para começar.
          </div>
        )}
        {upcoming.map((a) => (
          <AppointmentRow
            key={a.id}
            appt={a}
            evaluatorEmail={evaluatorEmailFor(a.evaluatorId)}
            onClick={() => setSelected({ cardId: a.cardId, pipelineId: a.pipelineId })}
          />
        ))}

        {past.length > 0 && (
          <details className="mt-6">
            <summary className="ck-eyebrow cursor-pointer">Anteriores ({past.length})</summary>
            <div className="mt-3 space-y-2 opacity-70">
              {past.map((a) => (
                <AppointmentRow
                  key={a.id}
                  appt={a}
                  evaluatorEmail={evaluatorEmailFor(a.evaluatorId)}
                  onClick={() => setSelected({ cardId: a.cardId, pipelineId: a.pipelineId })}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      <CardDetailDialog
        cardId={selected?.cardId ?? null}
        stages={selectedBoard?.stages ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
