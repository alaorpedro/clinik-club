import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { getCardDetail, upsertAppointment, listMembers, listClosedDates } from "@/lib/crm.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// Combina <input type="date"> + <input type="time"> num ISO só na hora de
// salvar — mais simples de editar que um único datetime-local, e os dois
// inputs nativos já cobrem o teclado/picker certo em mobile e desktop.
function toIsoOrNull(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function splitIso(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function ScheduleAppointmentDialog({
  cardId,
  onOpenChange,
}: {
  cardId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getCardDetail);
  const fetchMembers = useServerFn(listMembers);
  const fetchClosedDates = useServerFn(listClosedDates);
  const saveFn = useServerFn(upsertAppointment);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [evaluatorId, setEvaluatorId] = useState<string>("none");

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

  const { data: closedData } = useQuery({
    queryKey: ["crm", "closedDates"],
    queryFn: () => fetchClosedDates(),
    enabled: !!cardId,
  });
  const closedEntry = closedData?.closedDates?.find((c: { date: string }) => c.date === date) as
    | { date: string; reason: string | null; startTime: string | null; endTime: string | null }
    | undefined;
  // Sem startTime/endTime = dia inteiro fechado, então qualquer horário conta;
  // com os dois, só avisa se o horário escolhido cair dentro da janela fechada.
  const isClosedDay =
    !!closedEntry &&
    (!closedEntry.startTime ||
      !closedEntry.endTime ||
      !time ||
      (time >= closedEntry.startTime.slice(0, 5) && time < closedEntry.endTime.slice(0, 5)));

  // Pré-preenche com o agendamento existente (reagendar) — em branco quando é a
  // primeira vez que esse card recebe data/horário.
  useEffect(() => {
    if (!cardId) return;
    const appt = data?.appointment as { scheduled_at: string; evaluator_id: string | null } | null;
    const split = splitIso(appt?.scheduled_at);
    setDate(split.date);
    setTime(split.time);
    setEvaluatorId(appt?.evaluator_id ?? "none");
  }, [cardId, data?.appointment]);

  const saveMut = useMutation({
    mutationFn: () => {
      const scheduledAt = toIsoOrNull(date, time);
      if (!scheduledAt) throw new Error("Preencha a data e o horário.");
      return saveFn({
        data: {
          cardId: cardId!,
          scheduledAt,
          evaluatorId: evaluatorId === "none" ? null : evaluatorId,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm"] });
      toast.success("Agendamento salvo.");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar o agendamento."),
  });

  const leadName = (data?.card as any)?.leads?.name ?? "este lead";

  return (
    <Dialog open={!!cardId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Marcar avaliação
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Data, horário e avaliador para <span className="font-medium text-foreground">{leadName}</span>.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="ck-eyebrow mb-1.5">Data</p>
                <Input
                  type="date"
                  className="ck-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <p className="ck-eyebrow mb-1.5">Horário</p>
                <Input
                  type="time"
                  className="ck-input"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            {isClosedDay && (
              <p className="flex items-center gap-1.5 text-xs text-[var(--ck-warning)]">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {closedEntry?.startTime && closedEntry?.endTime
                  ? `Esse horário está dentro da janela fechada (${closedEntry.startTime.slice(0, 5)}–${closedEntry.endTime.slice(0, 5)}) na Agenda — ainda dá pra agendar, mas confira antes.`
                  : "Esse dia está marcado como fechado na Agenda — ainda dá pra agendar, mas confira antes."}
              </p>
            )}
            <div>
              <p className="ck-eyebrow mb-1.5">Avaliador</p>
              <Select value={evaluatorId} onValueChange={setEvaluatorId}>
                <SelectTrigger className="ck-input h-9 w-full">
                  <SelectValue placeholder="A definir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">A definir</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="ck-btn" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="ck-btn"
            disabled={!date || !time || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Salvando..." : "Salvar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
