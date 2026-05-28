import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const StripeEmbeddedCheckout = lazy(() =>
  import("@/components/StripeEmbeddedCheckout").then((m) => ({ default: m.StripeEmbeddedCheckout })),
);

export const Route = createFileRoute("/_authenticated/app/crm/upgrade")({
  component: UpgradePage,
});

const FEATURES = [
  "Pipeline em kanban com etapas personalizáveis",
  "Captura automática de leads dos seus funis",
  "Atendimento por atendente com atribuição de leads",
  "Anotações e histórico completo de cada lead",
  "Relatórios de origem, conversão e leads parados",
  "Exportação em XLSX",
];

function UpgradePage() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? null });
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto py-10">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 md:p-12 border-b border-border">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Módulo adicional
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-tight">CRM Clinik.Club</h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Organize seus leads em pipeline, distribua para atendentes e acompanhe a conversão até a venda.
            Tudo integrado aos seus funis.
          </p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight">R$ 97</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <Button
            size="lg"
            className="mt-6 rounded-full px-8"
            onClick={() => setOpen(true)}
            disabled={!user}
          >
            Ativar CRM agora
          </Button>
          {!user && (
            <p className="mt-2 text-xs text-muted-foreground">Carregando seus dados…</p>
          )}
        </div>
        <div className="p-8 md:p-12">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">O que está incluído</h2>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-muted-foreground">
            Cobrança mensal. Cancele a qualquer momento. O CRM é independente do seu plano de funis.
          </p>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Ativar CRM Clinik.Club</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {user && open && (
              <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>}>
                <StripeEmbeddedCheckout
                  priceId="crm_addon_monthly"
                  userId={user.id}
                  customerEmail={user.email ?? undefined}
                  returnUrl={`${window.location.origin}/app/crm/pipelines`}
                />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}