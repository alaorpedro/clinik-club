import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppHome,
});

type Funnel = { id: string; name: string; slug: string; status: string; created_at: string };

function AppHome() {
  const [funnels, setFunnels] = useState<Funnel[] | null>(null);

  useEffect(() => {
    supabase.from("funnels").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) toast.error(error.message);
      setFunnels(data ?? []);
    });
  }, []);

  async function createFunnel() {
    const name = prompt("Nome do funil:");
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase.from("funnels").insert({ name, slug, owner_id: u.user.id }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Funil criado!");
    setFunnels((prev) => [data as Funnel, ...(prev ?? [])]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Meus funis</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie seus funis interativos.</p>
        </div>
        <Button onClick={createFunnel} className="rounded-full font-semibold"><Plus className="h-4 w-4 mr-1" />Novo funil</Button>
      </div>
      {funnels === null ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : funnels.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-background p-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
          <h2 className="mt-5 text-xl font-bold">Nenhum funil ainda</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">Crie seu primeiro funil interativo e comece a capturar leads em minutos.</p>
          <Button onClick={createFunnel} className="mt-6 rounded-full font-semibold"><Plus className="h-4 w-4 mr-1" />Criar primeiro funil</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnels.map((f) => (
            <div key={f.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-card transition">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{f.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === "published" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{f.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">/{f.slug}</p>
              <div className="mt-4 flex gap-2">
                <Link to="/app/funis/$id/editar" params={{ id: f.id }}>
                  <Button size="sm" variant="outline" className="rounded-full">Editar</Button>
                </Link>
                <Link to="/app/funis/$id/leads" params={{ id: f.id }}>
                  <Button size="sm" variant="ghost" className="rounded-full">Leads</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}