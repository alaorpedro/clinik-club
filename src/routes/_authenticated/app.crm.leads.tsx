import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { listLeads } from "@/lib/crm.functions";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/crm/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const fetchLeads = useServerFn(listLeads);
  const { data, isLoading } = useQuery({
    queryKey: ["crm", "leads"],
    queryFn: () => fetchLeads(),
  });
  const [q, setQ] = useState("");

  const leads = useMemo(() => {
    const all = data?.leads ?? [];
    if (!q.trim()) return all;
    const needle = q.toLowerCase();
    return all.filter((l: any) =>
      [l.name, l.email, l.phone, l.funnel_name].some((v) => v?.toLowerCase().includes(needle)),
    );
  }, [data, q]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">Todos os leads capturados pelos seus funis.</p>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email, telefone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 rounded-full"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Nenhum lead encontrado.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-background overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Lead</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Funil</th>
                <th className="text-left px-4 py-3">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: any) => (
                <tr key={l.id} className="border-t border-border hover:bg-secondary/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{l.name ?? "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground">{l.email ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.funnel_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}