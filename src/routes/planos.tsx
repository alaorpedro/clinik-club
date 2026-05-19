import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — odontolink" },
      { name: "description", content: "Escolha o plano ideal para o seu volume de leads. Starter, Pro e Agency." },
      { property: "og:title", content: "Planos — odontolink" },
      { property: "og:description", content: "Escolha o plano ideal para o seu volume de leads." },
    ],
  }),
  component: PlanosPage,
});

const plans = [
  {
    name: "Starter", price: "R$ 47", period: "/mês",
    desc: "Para profissionais começando a vender online.",
    features: ["1 funil ativo", "Até 500 leads/mês", "Analytics básico", "Suporte por email"],
    cta: "Começar com Starter", highlight: false,
  },
  {
    name: "Pro", price: "R$ 97", period: "/mês",
    desc: "Para quem já roda tráfego pago e precisa escalar.",
    features: ["10 funis ativos", "Até 5.000 leads/mês", "Analytics completo", "Integração com checkouts", "Suporte prioritário"],
    cta: "Assinar Pro", highlight: true,
  },
  {
    name: "Agency", price: "R$ 297", period: "/mês",
    desc: "Para agências gerenciando múltiplos clientes.",
    features: ["Funis ilimitados", "Leads ilimitados", "Subcontas para clientes", "API e webhooks", "Suporte dedicado"],
    cta: "Falar com vendas", highlight: false,
  },
];

function PlanosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Planos</p>
            <h1 className="mt-2 text-5xl font-black tracking-tight">Escolha o plano ideal pra você</h1>
            <p className="mt-4 text-muted-foreground">Cancele a qualquer momento. Sem fidelidade.</p>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p) => (
              <div key={p.name} className={`rounded-3xl border p-8 ${p.highlight ? "bg-foreground text-background border-foreground shadow-card" : "bg-card border-border shadow-soft"}`}>
                {p.highlight && <span className="inline-block mb-3 rounded-full bg-highlight text-foreground px-3 py-1 text-xs font-bold">Mais popular</span>}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className={`mt-1 text-sm ${p.highlight ? "text-background/70" : "text-muted-foreground"}`}>{p.desc}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-black">{p.price}</span>
                  <span className={p.highlight ? "text-background/60" : "text-muted-foreground"}>{p.period}</span>
                </div>
                <Button asChild className={`mt-6 w-full rounded-full font-semibold ${p.highlight ? "bg-highlight text-foreground hover:bg-highlight/90" : ""}`} variant={p.highlight ? "default" : "default"}>
                  <Link to="/cadastro">{p.cta}</Link>
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
            ))}
          </div>
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Precisa de algo customizado? <Link to="/contato" className="text-primary font-medium">Fale com a gente</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}