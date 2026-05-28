import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const StripeEmbeddedCheckout = lazy(() =>
  import("@/components/StripeEmbeddedCheckout").then((m) => ({ default: m.StripeEmbeddedCheckout })),
);

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Clinik.Club" },
      { name: "description", content: "Escolha o plano ideal para o seu volume de leads. Starter, Pro e Agency." },
      { property: "og:title", content: "Planos — Clinik.Club" },
      { property: "og:description", content: "Escolha o plano ideal para o seu volume de leads." },
      { property: "og:url", content: "https://clinik.club/planos" },
    ],
    links: [
      { rel: "canonical", href: "https://clinik.club/planos" },
    ],
  }),
  component: PlanosPage,
});

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

function PlanosPage() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("monthly");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser({ id: data.user.id, email: data.user.email ?? null });
    });
  }, []);

  function handleSubscribe(priceId: string) {
    setCheckoutPriceId(priceId);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Planos</p>
            <h1 className="mt-2 text-5xl font-black tracking-tight">Escolha o plano ideal pra você</h1>
            <p className="mt-4 text-muted-foreground">Cancele a qualquer momento. Sem fidelidade.</p>
            <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
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
          <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p) => {
              const current = p[interval];
              return (
              <div key={p.name} className={`rounded-3xl border p-8 ${p.highlight ? "bg-foreground text-background border-foreground shadow-card" : "bg-card border-border shadow-soft"}`}>
                {p.highlight && <span className="inline-block mb-3 rounded-full bg-highlight text-foreground px-3 py-1 text-xs font-bold">Mais popular</span>}
                <h2 className="text-xl font-bold">{p.name}</h2>
                <p className={`mt-1 text-sm ${p.highlight ? "text-background/70" : "text-muted-foreground"}`}>{p.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-black">{current.price}</span>
                  <span className={p.highlight ? "text-background/60" : "text-muted-foreground"}>{current.period}</span>
                </div>
                {interval === "yearly" && "note" in current && (
                  <p className={`mt-1 text-xs ${p.highlight ? "text-background/60" : "text-muted-foreground"}`}>{current.note}</p>
                )}
                <Button
                  onClick={() => handleSubscribe(current.priceId)}
                  className={`mt-6 w-full rounded-full font-semibold ${p.highlight ? "bg-highlight text-foreground hover:bg-highlight/90" : ""}`}
                >
                  {p.cta}
                </Button>
                <ul className="mt-8 space-y-3 text-sm">
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
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Precisa de algo customizado? <Link to="/contato" className="text-primary font-medium">Fale com a gente</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
      <Dialog open={!!checkoutPriceId} onOpenChange={(open) => !open && setCheckoutPriceId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Finalizar assinatura</DialogTitle>
          </DialogHeader>
          {checkoutPriceId && (
            <Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Carregando checkout...</div>}>
              <StripeEmbeddedCheckout
                priceId={checkoutPriceId}
                
                customerEmail={user?.email ?? undefined}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}