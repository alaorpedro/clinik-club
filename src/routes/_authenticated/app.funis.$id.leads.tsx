import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Mail, Phone, Calendar, ChevronDown, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/funis/$id/leads")({
  component: LeadsPage,
});

type Lead = { id: string; name: string | null; email: string | null; phone: string | null; answers: any; created_at: string; status?: string | null; last_step_index?: number | null };
type Step = { id: string; type: string; order: number; config: any };

function LeadsPage() {
  const { id } = Route.useParams();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [funnelName, setFunnelName] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("funnels").select("name").eq("id", id).maybeSingle().then(({ data }) => setFunnelName((data as any)?.name ?? ""));
    supabase.from("leads").select("*").eq("funnel_id", id).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) toast.error(error.message);
      setLeads((data as Lead[]) ?? []);
    });
    supabase.from("funnel_steps").select("id,type,order,config").eq("funnel_id", id).order("order", { ascending: true }).then(({ data }) => {
      setSteps((data as Step[]) ?? []);
    });
  }, [id]);

  const stepMap = useMemo(() => {
    const m: Record<string, { label: string; order: number; type: string }> = {};
    steps.forEach((s, i) => {
      const cfg = s.config || {};
      const label = (cfg.title || cfg.subtitle || cfg.body || `Etapa ${i + 1}`).toString().trim().slice(0, 120);
      m[`step_${s.id}`] = { label, order: s.order ?? i, type: s.type };
    });
    return m;
  }, [steps]);

  function formatAnswer(v: any): string {
    if (v == null || v === "") return "—";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  function answerEntries(answers: any) {
    if (!answers || typeof answers !== "object") return [];
    return Object.entries(answers)
      .map(([k, v]) => ({ key: k, label: stepMap[k]?.label ?? k, order: stepMap[k]?.order ?? 999, value: v }))
      .sort((a, b) => a.order - b.order);
  }

  const filtered = useMemo(() => {
    if (!leads) return null;
    const t = q.trim().toLowerCase();
    if (!t) return leads;
    return leads.filter((l) => [l.name, l.email, l.phone, JSON.stringify(l.answers ?? {})].join(" ").toLowerCase().includes(t));
  }, [leads, q]);

  function exportCsv() {
    if (!leads?.length) return;
    const stepCols = steps.map((s, i) => ({ key: `step_${s.id}`, label: (s.config?.title || `Etapa ${i + 1}`) }));
    const rows = [
      ["Data", "Nome", "Email", "WhatsApp", ...stepCols.map((c) => c.label)],
      ...leads.map((l) => [
        new Date(l.created_at).toLocaleString("pt-BR"),
        l.name ?? "",
        l.email ?? "",
        l.phone ?? "",
        ...stepCols.map((c) => formatAnswer(l.answers?.[c.key])),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function initials(name: string | null, email: string | null) {
    const src = (name || email || "?").trim();
    const parts = src.split(/\s+|@/).filter(Boolean);
    return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  }

  function relTime(d: string) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} d atrás`;
    return new Date(d).toLocaleDateString("pt-BR");
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/funis/$id/editar" params={{ id }}><ArrowLeft className="h-4 w-4 mr-1" />Voltar ao editor</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Leads</h1>
            <p className="text-xs text-muted-foreground">{funnelName}</p>
          </div>
        </div>
        <Button onClick={exportCsv} disabled={!leads?.length} variant="outline" size="sm" className="rounded-full"><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
      </div>

      {leads && leads.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone ou resposta..."
            className="flex-1 h-10 px-4 rounded-full border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered?.length ?? 0} de {leads.length}</span>
        </div>
      )}

      {leads === null ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <p className="font-semibold">Nenhum lead ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Publique seu funil e compartilhe o link para capturar leads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((l) => {
            const entries = answerEntries(l.answers);
            const isOpen = !!open[l.id];
            const preview = entries.slice(0, 2);
            return (
              <div key={l.id} className="rounded-2xl border border-border bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [l.id]: !o[l.id] }))}
                  className="w-full text-left px-4 py-4 flex items-start gap-4 hover:bg-secondary/40 transition"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {initials(l.name, l.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{l.name || "Sem nome"}</span>
                      {l.status === "partial" ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Incompleto</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-800">Completo</span>
                      )}
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{relTime(l.created_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {l.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</span>}
                      {l.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                      {!l.email && !l.phone && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />Sem contato</span>}
                    </div>
                    {!isOpen && preview.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {preview.map((e) => (
                          <span key={e.key} className="inline-flex items-center gap-1 max-w-full text-[11px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            <span className="font-medium truncate max-w-[160px]">{e.label}:</span>
                            <span className="truncate max-w-[200px]">{formatAnswer(e.value)}</span>
                          </span>
                        ))}
                        {entries.length > preview.length && (
                          <span className="text-[11px] text-muted-foreground">+{entries.length - preview.length} respostas</span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-border bg-secondary/20 px-4 py-4">
                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma resposta registrada.</p>
                    ) : (
                      <ul className="space-y-3">
                        {entries.map((e) => (
                          <li key={e.key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                            <span className="text-xs font-semibold text-muted-foreground sm:w-1/2 break-words">{e.label}</span>
                            <span className="text-sm sm:w-1/2 break-words">{formatAnswer(e.value)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-4 text-[11px] text-muted-foreground">Recebido em {new Date(l.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>
            );
          })}
          {filtered && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum lead encontrado para "{q}".</div>
          )}
        </div>
      )}
    </div>
  );
}