import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Copy, Settings, Lock, CheckCircle2, Crown, Trash2, Users, MousePointer2, BarChart3, TrendingUp, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FunnelSettingsDialog } from "@/components/FunnelSettingsDialog";
import { PlansDialog } from "@/components/PlansDialog";
import { showPrompt, showConfirm } from "@/components/ModalDialogs";
import { useServerFn } from "@tanstack/react-start";
import { createFunnelChecked, deleteFunnel, getPlanUsage } from "@/lib/funnels.functions";
import { getMyBillingProfile } from "@/lib/account.functions";

type PaymentsEnv = "sandbox" | "live";

export const Route = createFileRoute("/_authenticated/app/")({
  component: AppHome,
  errorComponent: ({ error, reset }) => (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <h2 className="font-bold text-destructive">Erro ao carregar seus funis</h2>
      <p className="mt-1 text-muted-foreground">{error?.message ?? "Tente novamente."}</p>
      <Button size="sm" variant="outline" className="ck-btn mt-4" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </div>
  ),
});

type Funnel = { id: string; name: string; slug: string; status: string; created_at: string };

const STATUS_LABEL: Record<string, string> = {
  published: "Publicado",
  draft: "Rascunho",
  archived: "Arquivado",
};

function getPaymentsEnvironment(): PaymentsEnv {
  const token = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
  return token?.startsWith("pk_test_") ? "sandbox" : "live";
}

function AppHome() {
  const [funnels, setFunnels] = useState<Funnel[] | null>(null);
  const [settingsFor, setSettingsFor] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    tier: string;
    hasPlan: boolean;
    maxFunnels: number | null;
    maxLeadsPerMonth: number;
    funnelsUsed: number;
    leadsUsedThisMonth: number;
  } | null>(null);
  const [billingIncomplete, setBillingIncomplete] = useState<boolean | null>(null);
  const deleteFunnelFn = useServerFn(deleteFunnel);
  const createFunnelFn = useServerFn(createFunnelChecked);
  const getPlanUsageFn = useServerFn(getPlanUsage);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setFunnels([]);
        return;
      }
      const { data, error } = await supabase
        .from("funnels")
        .select("*")
        .eq("owner_id", u.user.id)
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setFunnels(data ?? []);
      try {
        const u2 = await getPlanUsageFn({ data: { environment: getPaymentsEnvironment() } });
        setUsage(u2);
        setHasPlan(u2.hasPlan);
        setPlanName(u2.hasPlan ? u2.tier.charAt(0).toUpperCase() + u2.tier.slice(1) : null);
      } catch (err: any) {
        setHasPlan(false);
        toast.error(err?.message ?? "Não foi possível verificar seu plano.");
      }
      try {
        const { billing } = await getMyBillingProfile();
        setBillingIncomplete(!billing?.tax_id);
      } catch {
        // never block the dashboard over the billing reminder
      }
    })();
  }, [getPlanUsageFn]);

  async function attemptCreateFunnel(name: string, slug: string) {
    try {
      const data = await createFunnelFn({ data: { name, slug, environment: getPaymentsEnvironment() } });
      if (data && "error" in data && data.error === "slug_taken") {
        const useSuggestion = await showConfirm({
          title: "Esse link já está em uso",
          description: `Já existe outro funil usando "/f/${data.slug}" (o link é único em toda a plataforma). Quer usar "/f/${data.suggestedSlug}" no lugar?`,
          okText: `Usar /f/${data.suggestedSlug}`,
          cancelText: "Escolher outro nome",
        });
        if (useSuggestion) {
          await attemptCreateFunnel(name, data.suggestedSlug);
        }
        return;
      }
      toast.success("Funil criado!");
      setFunnels((prev) => [data as Funnel, ...(prev ?? [])]);
      setUsage((prev) => prev ? { ...prev, funnelsUsed: prev.funnelsUsed + 1 } : prev);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar funil.");
    }
  }

  async function createFunnel() {
    if (!hasPlan) {
      toast.error("Você precisa de um plano ativo para criar funis.");
      return;
    }
    const name = await showPrompt({ title: "Novo funil", label: "Nome do funil:", placeholder: "Ex.: Captação Botox" });
    if (!name) return;
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!slug) {
      toast.error("Nome inválido para gerar o link do funil.");
      return;
    }
    await attemptCreateFunnel(name, slug);
  }

  async function handleDelete(f: Funnel) {
    const ok = await showConfirm({
      title: "Excluir funil?",
      description: `Tem certeza que deseja excluir "${f.name}"? Esta ação não pode ser desfeita.`,
      okText: "Excluir",
      cancelText: "Cancelar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteFunnelFn({ data: { funnelId: f.id } });
      toast.success("Funil excluído!");
      setFunnels((prev) => prev?.filter((x) => x.id !== f.id) ?? null);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir funil.");
    }
  }

  return (
    <div>
      {hasPlan === false && (
        <div className="ck-r-sig mb-6 border border-primary/20 bg-primary/5 p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Ative um plano para começar</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Você precisa de um plano ativo para criar e publicar funis. Conta criada com sucesso — falta só escolher seu plano.</p>
          </div>
          <Button size="sm" onClick={() => setPlansOpen(true)} className="ck-btn font-semibold shrink-0">
            Ver planos
          </Button>
        </div>
      )}
      {hasPlan === true && billingIncomplete === true && (
        <div className="ck-r-sig mb-6 border border-[var(--ck-warning)]/30 bg-[var(--ck-warning-bg)] p-5 flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ck-warning)]/15 text-[var(--ck-warning)]">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Complete seus dados de faturamento</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Precisamos do seu CNPJ ou CPF e endereço para emitir a nota fiscal dos seus pagamentos.</p>
          </div>
          <Button asChild size="sm" variant="outline" className="ck-btn font-semibold shrink-0">
            <Link to="/app/conta">Completar dados</Link>
          </Button>
        </div>
      )}
      {usage && (() => {
        const funnelsPct = usage.maxFunnels ? usage.funnelsUsed / usage.maxFunnels : 0;
        const leadsPct = usage.maxLeadsPerMonth ? usage.leadsUsedThisMonth / usage.maxLeadsPerMonth : 0;
        const alert = funnelsPct >= 0.8 || leadsPct >= 0.8;
        if (!alert) return null;
        const funnelsAtLimit = usage.maxFunnels !== null && usage.funnelsUsed >= usage.maxFunnels;
        const leadsAtLimit = usage.leadsUsedThisMonth >= usage.maxLeadsPerMonth;
        const critical = funnelsAtLimit || leadsAtLimit;
        return (
          <div className={`ck-r-sig mb-6 border p-5 flex items-center gap-4 ${critical ? "border-destructive/30 bg-destructive/5" : "border-[var(--ck-warning)]/30 bg-[var(--ck-warning-bg)]"}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${critical ? "bg-destructive/15 text-destructive" : "bg-[var(--ck-warning)]/15 text-[var(--ck-warning)]"}`}>
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0 text-sm">
              <h3 className="font-bold">{critical ? "Limite do plano atingido" : "Você está perto do limite do seu plano"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {usage.maxFunnels !== null && (
                  <>Funis: <strong>{usage.funnelsUsed}/{usage.maxFunnels}</strong>. </>
                )}
                Leads este mês: <strong>{usage.leadsUsedThisMonth.toLocaleString("pt-BR")}/{usage.maxLeadsPerMonth.toLocaleString("pt-BR")}</strong>.
              </p>
            </div>
            <Button size="sm" onClick={() => setPlansOpen(true)} className="ck-btn font-semibold shrink-0">
              Fazer upgrade
            </Button>
          </div>
        );
      })()}
      {usage && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="ck-card border-border shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Leads no Mês</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="ck-num text-2xl font-light">{usage.leadsUsedThisMonth.toLocaleString("pt-BR")}</div>
              <p className="text-[10px] text-muted-foreground mt-1">
                de {usage.maxLeadsPerMonth.toLocaleString("pt-BR")} contratados
              </p>
              <div className="mt-3 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${usage.leadsUsedThisMonth / usage.maxLeadsPerMonth > 0.9 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, (usage.leadsUsedThisMonth / usage.maxLeadsPerMonth) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="ck-card border-border shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Funis Ativos</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="ck-num text-2xl font-light">{usage.funnelsUsed}</div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {usage.maxFunnels ? `limite de ${usage.maxFunnels} funis` : "funis ilimitados"}
              </p>
              <div className="mt-3 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${usage.maxFunnels ? Math.min(100, (usage.funnelsUsed / usage.maxFunnels) * 100) : 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
          <Card className="ck-card border-border shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxa de Conversão</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="ck-num text-2xl font-light">--</div>
              <p className="text-[10px] text-muted-foreground mt-1">média de todos os funis</p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1 w-fit">
                <Sparkles className="h-3 w-3 text-primary" />
                Em breve
              </div>
            </CardContent>
          </Card>
          <Card className="ck-card border-border shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliques Totais</CardTitle>
              <MousePointer2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="ck-num text-2xl font-light">--</div>
              <p className="text-[10px] text-muted-foreground mt-1">visitas nos seus links</p>
              <div className="mt-3 flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-secondary/50 rounded-lg px-2 py-1 w-fit">
                <Sparkles className="h-3 w-3 text-primary" />
                Em breve
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="ck-display text-3xl md:text-4xl tracking-tight">Meus funis</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Crie e gerencie seus funis interativos.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {hasPlan && planName && (
            <span className="inline-flex items-center gap-1.5 rounded-[var(--ck-r-flat-sm)] bg-primary/10 text-primary px-3 py-1.5 text-[10px] md:text-xs font-bold border border-primary/20">
              <Crown className="h-3.5 w-3.5" />
              Plano {planName}
            </span>
          )}
          {hasPlan === false ? (
            <Button onClick={() => setPlansOpen(true)} className="ck-btn font-semibold text-xs md:text-sm h-9 md:h-10 px-4 md:px-5">
              <Lock className="h-4 w-4 mr-1" />Ativar plano
            </Button>
          ) : (
            <Button onClick={createFunnel} className="ck-btn font-semibold text-xs md:text-sm h-9 md:h-10 px-4 md:px-5">
              <Plus className="h-4 w-4 mr-1" />Novo funil
            </Button>
          )}
        </div>
      </div>
      {funnels === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Carregando funis">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6 shadow-soft animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-5 w-16 bg-muted rounded-full" />
              </div>
              <div className="mt-2 h-3 w-20 bg-muted rounded" />
              <div className="mt-5 flex gap-2">
                <div className="h-8 w-16 bg-muted rounded-full" />
                <div className="h-8 w-16 bg-muted rounded-full" />
                <div className="h-8 w-8 bg-muted rounded-full ml-auto" />
                <div className="h-8 w-8 bg-muted rounded-full" />
                <div className="h-8 w-8 bg-muted rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : funnels.length === 0 ? (
        hasPlan === false ? (
          <div className="ck-r-sig border-2 border-dashed border-primary/30 bg-background p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
            <h2 className="mt-5 text-xl font-bold">Bem-vindo(a) ao Clinik.Club! 🎉</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">Sua conta está pronta. Para criar seu primeiro funil e começar a capturar leads, escolha um plano abaixo.</p>
            <div className="mt-6 mx-auto max-w-sm space-y-2 text-left text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>Funis ilimitados de captação</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>Link público para compartilhar</span></div>
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0" /><span>Cancele quando quiser</span></div>
            </div>
            <Button onClick={() => setPlansOpen(true)} className="ck-btn mt-6 font-semibold">
              Escolher meu plano
            </Button>
          </div>
        ) : (
          <div className="ck-r-sig border-2 border-dashed border-border bg-background p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
            <h2 className="mt-5 text-xl font-bold">Nenhum funil ainda</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">Crie seu primeiro funil interativo e comece a capturar leads em minutos.</p>
            <Button onClick={createFunnel} className="ck-btn mt-6 font-semibold"><Plus className="h-4 w-4 mr-1" />Criar primeiro funil</Button>
          </div>
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnels.map((f) => (
            <div key={f.id} className="ck-card border border-border bg-card p-6 shadow-soft hover:shadow-card transition">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{f.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-[var(--ck-r-flat-sm)] ${f.status === "published" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{STATUS_LABEL[f.status] ?? f.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">/{f.slug}</p>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <Button asChild size="sm" variant="outline" style={{ borderRadius: "var(--ck-r-flat)" }}>
                  <Link to="/app/funis/$id/editar" params={{ id: f.id }}>Editar</Link>
                </Button>
                <Button asChild size="sm" variant="ghost" style={{ borderRadius: "var(--ck-r-flat)" }}>
                  <Link to="/app/funis/$id/leads" params={{ id: f.id }}>Leads</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ borderRadius: "var(--ck-r-flat)" }}
                  className="ml-auto"
                  title="Configurações do funil"
                  aria-label={`Configurações do funil ${f.name}`}
                  onClick={() => setSettingsFor(f.id)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ borderRadius: "var(--ck-r-flat)" }}
                  title="Copiar link público"
                  aria-label={`Copiar link público do funil ${f.name}`}
                  onClick={() => {
                    const url = `${window.location.origin}/f/${f.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copiado!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ borderRadius: "var(--ck-r-flat)" }}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Excluir funil"
                  aria-label={`Excluir funil ${f.name}`}
                  onClick={() => handleDelete(f)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
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