import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/funis/$id/leads")({
  component: LeadsPage,
});

type Lead = { id: string; name: string | null; email: string | null; phone: string | null; answers: any; created_at: string };

function LeadsPage() {
  const { id } = Route.useParams();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [funnelName, setFunnelName] = useState("");

  useEffect(() => {
    supabase.from("funnels").select("name").eq("id", id).maybeSingle().then(({ data }) => setFunnelName((data as any)?.name ?? ""));
    supabase.from("leads").select("*").eq("funnel_id", id).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) toast.error(error.message);
      setLeads((data as Lead[]) ?? []);
    });
  }, [id]);

  function exportCsv() {
    if (!leads?.length) return;
    const rows = [
      ["Data", "Nome", "Email", "WhatsApp", "Respostas"],
      ...leads.map((l) => [
        new Date(l.created_at).toLocaleString("pt-BR"),
        l.name ?? "",
        l.email ?? "",
        l.phone ?? "",
        JSON.stringify(l.answers ?? {}),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link to="/app/funis/$id/editar" params={{ id }}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Voltar ao editor</Button></Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Leads</h1>
            <p className="text-xs text-muted-foreground">{funnelName}</p>
          </div>
        </div>
        <Button onClick={exportCsv} disabled={!leads?.length} variant="outline" size="sm" className="rounded-full"><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
      </div>

      {leads === null ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <p className="font-semibold">Nenhum lead ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Publique seu funil e compartilhe o link para capturar leads.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Nome</th>
                  <th className="px-4 py-3 font-semibold">E-mail</th>
                  <th className="px-4 py-3 font-semibold">WhatsApp</th>
                  <th className="px-4 py-3 font-semibold">Respostas</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">{l.name ?? "—"}</td>
                    <td className="px-4 py-3">{l.email ?? "—"}</td>
                    <td className="px-4 py-3">{l.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-md truncate">{JSON.stringify(l.answers ?? {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}