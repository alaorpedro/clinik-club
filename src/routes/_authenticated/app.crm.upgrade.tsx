import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ArrowLeft } from "lucide-react";
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
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [showCoupon, setShowCoupon] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="h-4 w-4" /> Voltar ao Painel
      </Link>

      <div className="ck-r-sig border border-border bg-card overflow-hidden grid md:grid-cols-2">
        <div className="bg-primary/5 p-8 md:p-12 border-b md:border-b-0 md:border-r border-border">
          <div className="inline-flex items-center gap-2 rounded-[var(--ck-r-flat-sm)] bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <img src="/brand/clinik-icon.svg" alt="" className="h-3.5 w-3.5" /> Módulo adicional
          </div>
          <h1 className="mt-4 ck-display text-4xl md:text-5xl tracking-tight">CRM Clinik.Club</h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Organize seus leads em pipeline, distribua para atendentes e acompanhe a conversão até a venda.
            Tudo integrado aos seus funis.
          </p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="ck-num text-5xl font-light tracking-tight">R$ 1.200</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <Button
            size="lg"
            className="ck-btn mt-6 px-8"
            onClick={() => setOpen(true)}
          >
            Ativar CRM agora
          </Button>

          {/* Cupom precisa ser aplicado antes de abrir o checkout — o Stripe só
           * dispensa pedir cartão (payment_method_collection: if_required) se o
           * total já nasce zerado na criação da sessão, não quando o código é
           * digitado depois, dentro da tela do Stripe. */}
          {showCoupon ? (
            <Input
              autoFocus
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Código do cupom"
              className="ck-input mt-3 h-9 w-48 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowCoupon(true)}
              className="mt-3 block text-xs text-muted-foreground underline hover:text-foreground"
            >
              Tenho um cupom
            </button>
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

      <Dialog open={open} onOpenChange={setOpen} modal={false}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 shadow-2xl border-primary/20"
          allowStripePointerPassThrough={true}
        >
          <DialogHeader className="px-6 pt-6 text-left">
            <DialogTitle>Ativar CRM Clinik.Club</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {user && open && (
              <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>}>
                <StripeEmbeddedCheckout
                  priceId="crm_addon_monthly"
                  customerEmail={user.email ?? undefined}
                  returnUrl={`${window.location.origin}/app/crm/pipelines`}
                  promoCode={promoCode.trim() || undefined}
                />
              </Suspense>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}