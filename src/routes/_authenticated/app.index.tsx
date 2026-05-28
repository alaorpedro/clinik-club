import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Copy, Settings, Lock, CheckCircle2, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FunnelSettingsDialog } from "@/components/FunnelSettingsDialog";
import { PlansDialog } from "@/components/PlansDialog";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
});

type Funnel = { id: string; name: string; slug: string; status: string; created_at: string };

function AppHome() {
  const [funnels, setFunnels] = useState<Funnel[] | null>(null);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("funnels").select("*").order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) toast.error(error.message);
      setFunnels(data ?? []);
    });
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: ok } = await supabase.rpc("has_active_subscription", {
        user_uuid: u.user.id,
        check_env: (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined)?.startsWith("pk_test_") ? "sandbox" : "live",
      });
      setHasPlan(!!ok);
      if (ok) {
        const env = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined)?.startsWith("pk_test_") ? "sandbox" : "live";
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("price_id")
          .eq("user_id", u.user.id)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (sub?.price_id) {
          const tier = sub.price_id.split("_")[0];
          setPlanName(tier.charAt(0).toUpperCase() + tier.slice(1));
        }
      }
    })();
  }, []);

  async function createFunnel() {
    if (!hasPlan) {
      toast.error("Você precisa de um plano ativo para criar funis.");
      return;
    }
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
      {hasPlan === false && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Ative um plano para começar</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Você precisa de um plano ativo para criar e publicar funis. Conta criada com sucesso — falta só escolher seu plano.</p>
          </div>
          <Button size="sm" onClick={() => setPlansOpen(true)} className="rounded-full font-semibold shrink-0">
            Ver planos
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Meus funis</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie seus funis interativos.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasPlan && planName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold border border-primary/20">
              <Crown className="h-3.5 w-3.5" />
              Plano {planName}
            </span>
          )}
          {hasPlan === false ? (
            <Button onClick={() => setPlansOpen(true)} className="rounded-full font-semibold">
              <Lock className="h-4 w-4 mr-1" />Ativar plano
            </Button>
          ) : (
            <Button onClick={createFunnel} className="rounded-full font-semibold"><Plus className="h-4 w-4 mr-1" />Novo funil</Button>
          )}
        </div>
      </div>
      {funnels === null ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : funnels.length === 0 ? (
        hasPlan === false ? (
          <div className="rounded-3xl border-2 border-dashed border-primary/30 bg-background p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
            <h2 className="mt-5 text-xl font-bold">Bem-vindo(a) ao Clinik.Club! 🎉</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">Sua conta está pronta. Para criar seu primeiro funil e começar a capturar leads, escolha um plano abaixo.</p>
            <div className="mt-6 mx-auto max-w-sm space-y-2 text-left text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>Funis ilimitados de captação</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>Link público para compartilhar</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>Cancele quando quiser</span></div>
            </div>
            <Button onClick={() => setPlansOpen(true)} className="mt-6 rounded-full font-semibold">
              Escolher meu plano
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-dashed border-border bg-background p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
            <h2 className="mt-5 text-xl font-bold">Nenhum funil ainda</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">Crie seu primeiro funil interativo e comece a capturar leads em minutos.</p>
            <Button onClick={createFunnel} className="mt-6 rounded-full font-semibold"><Plus className="h-4 w-4 mr-1" />Criar primeiro funil</Button>
          </div>
        )
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
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/app/funis/$id/editar" params={{ id: f.id }}>Editar</Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="rounded-full">
                  <Link to="/app/funis/$id/leads" params={{ id: f.id }}>Leads</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full ml-auto"
                  title="Configurações do funil"
                  onClick={() => setSettingsFor(f.id)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  title="Copiar link público"
                  onClick={() => {
                    const url = `${window.location.origin}/f/${f.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {settingsFor && (
        <FunnelSettingsDialog
          funnelId={settingsFor}
          open={!!settingsFor}
          onOpenChange={(v) => !v && setSettingsFor(null)}
          onSlugChange={(slug) => setFunnels((prev) => prev?.map((x) => x.id === settingsFor ? { ...x, slug } : x) ?? null)}
        />
      )}
      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </div>
  );
}