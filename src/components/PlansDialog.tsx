import { useEffect, useState, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

const StripeEmbeddedCheckout = lazy(() =>
  import("@/components/StripeEmbeddedCheckout").then((m) => ({ default: m.StripeEmbeddedCheckout })),
);

type Interval = "monthly" | "yearly";
const plans = [
  {
    name: "Starter",
    desc: "Para profissionais começando a vender online.",
    monthly: { price: "R$ 99", period: "/mês", priceId: "starter_monthly" },
    yearly: { price: "R$ 79", period: "/mês", priceId: "starter_yearly", note: "Cobrado R$ 950/ano" },
    features: ["1 funil ativo", "Até 400 leads/mês", "Analytics básico", "Suporte por email"],
    cta: "Assinar Starter", highlight: false,
  },
  {
    name: "Pro",
    desc: "Para quem já roda tráfego pago e precisa escalar.",
    monthly: { price: "R$ 159", period: "/mês", priceId: "pro_monthly" },
    yearly: { price: "R$ 127", period: "/mês", priceId: "pro_yearly", note: "Cobrado R$ 1.526/ano" },
    features: ["10 funis ativos", "Até 2.000 leads/mês", "Analytics completo", "Integração com checkouts", "Suporte prioritário"],
    cta: "Assinar Pro", highlight: true,
  },
  {
    name: "Agency",
    desc: "Para agências gerenciando múltiplos clientes.",
    monthly: { price: "R$ 449", period: "/mês", priceId: "agency_monthly" },
    yearly: { price: "R$ 359", period: "/mês", priceId: "agency_yearly", note: "Cobrado R$ 4.310/ano" },
    features: ["Funis ilimitados", "Até 20.000 leads/mês", "Subcontas para clientes", "API e webhooks", "White-label"],
    cta: "Assinar Agency", highlight: false,
  },
];

interface PlansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlansDialog({ open, onOpenChange }: PlansDialogProps) {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("monthly");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? null });
    });
  }, []);

  function handleClose(next: boolean) {
    if (!next) {
      setCheckoutPriceId(null);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-0">
        {checkoutPriceId ? (
          <div>
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Finalizar assinatura</DialogTitle>
              <DialogDescription>Preencha os dados de pagamento para ativar seu plano.</DialogDescription>
            </DialogHeader>
            <div className="px-2 sm:px-6 pb-6">
              <button
                onClick={() => setCheckoutPriceId(null)}
                className="mb-3 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                ← Voltar aos planos
              </button>
              <Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Carregando checkout...</div>}>
                <StripeEmbeddedCheckout
                  priceId={checkoutPriceId}
                  
                  customerEmail={user?.email ?? undefined}
                />
              </Suspense>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            <DialogHeader className="text-center">
              <DialogTitle className="text-3xl font-black tracking-tight">Escolha seu plano</DialogTitle>
              <DialogDescription>Cancele a qualquer momento. Sem fidelidade.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
                <button
                  onClick={() => setInterval("monthly")}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition ${interval === "monthly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setInterval("yearly")}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition flex items-center gap-2 ${interval === "yearly" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Anual
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${interval === "yearly" ? "bg-highlight text-foreground" : "bg-highlight/20 text-foreground"}`}>-20%</span>
                </button>
              </div>
            </div>
            <div className="mt-8 grid md:grid-cols-3 gap-4">
              {plans.map((p) => {
                const current = p[interval];
                return (
                  <div key={p.name} className={`rounded-2xl border p-6 ${p.highlight ? "bg-foreground text-background border-foreground shadow-card" : "bg-card border-border shadow-soft"}`}>
                    {p.highlight && <span className="inline-block mb-3 rounded-full bg-highlight text-foreground px-3 py-1 text-xs font-bold">Mais popular</span>}
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <p className={`mt-1 text-xs ${p.highlight ? "text-background/70" : "text-muted-foreground"}`}>{p.desc}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-black">{current.price}</span>
                      <span className={p.highlight ? "text-background/60" : "text-muted-foreground"}>{current.period}</span>
                    </div>
                    {interval === "yearly" && "note" in current && (
                      <p className={`mt-1 text-[11px] ${p.highlight ? "text-background/60" : "text-muted-foreground"}`}>{current.note}</p>
                    )}
                    <Button
                      onClick={() => setCheckoutPriceId(current.priceId)}
                      className={`mt-5 w-full rounded-full font-semibold ${p.highlight ? "bg-highlight text-foreground hover:bg-highlight/90" : ""}`}
                    >
                      {p.cta}
                    </Button>
                    <ul className="mt-6 space-y-2 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${p.highlight ? "text-highlight" : "text-primary"}`} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}