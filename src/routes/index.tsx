import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { QuizMockup } from "@/components/site/QuizMockup";
import { Button } from "@/components/ui/button";
import { Check, Zap, BarChart3, MousePointer2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clinik.Club — Funis de vendas interativos para clínicas" },
      { name: "description", content: "Transforme tráfego em pacientes com funis interativos. Crie quizzes, capture leads e acompanhe conversões em uma única plataforma." },
      { property: "og:title", content: "Clinik.Club — Funis de vendas interativos" },
      { property: "og:description", content: "Transforme tráfego em pacientes com funis interativos." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="container mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Funil de Vendas <span className="text-foreground/40">—</span> Eleve seu faturamento
              </div>
              <h1 className="mt-5 text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
                Engaje seus pacientes e aumente suas{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">consultas</span>
                  <span className="absolute inset-x-0 bottom-1 h-4 bg-highlight -z-0 -skew-x-3" />
                </span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                A <strong className="text-foreground">Clinik.Club</strong> transforma tráfego em pacientes com <strong className="text-foreground">funis de vendas interativos</strong>, visualmente otimizados e centralizados em uma única plataforma.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="rounded-full font-semibold h-12 px-6">
                  <Link to="/cadastro">Começar grátis</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full font-semibold h-12 px-6">
                  <Link to="/planos">Ver planos</Link>
                </Button>
              </div>
              
            </div>
            <div className="lg:pl-8">
              <QuizMockup />
            </div>
          </div>
        </section>

        {/* Logos parceiros */}
        <section className="border-y border-border/60 bg-secondary/40 py-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Integrações nativas</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-muted-foreground/70 font-semibold">
              {["Hotmart", "Kiwify", "Eduzz", "Kirvano", "Braip", "PerfectPay", "Ticto", "Monetizze"].map((n) => (
                <span key={n} className="text-base">{n}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Como funciona</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-black tracking-tight">3 passos para começar a converter</h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              { icon: MousePointer2, title: "1. Crie seu funil", desc: "Monte quizzes e formulários interativos arrastando blocos. Sem código." },
              { icon: Zap, title: "2. Publique e divulgue", desc: "Link próprio pronto para anúncios, Instagram e WhatsApp." },
              { icon: BarChart3, title: "3. Acompanhe e converta", desc: "Veja leads, taxa de conversão por etapa e exporte para seu CRM." },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-7 shadow-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recursos */}
        <section className="bg-secondary/40 py-20">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">Tudo que você precisa em <span className="text-primary">um só lugar</span></h2>
              <ul className="mt-8 space-y-4">
                {[
                  "Builder visual drag-and-drop",
                  "Capture e qualifique leads automaticamente",
                  "Analytics por etapa do funil",
                  "Integração com checkouts (Hotmart, Kiwify, etc.)",
                  "Exportação de leads para CSV ou CRM",
                  "Páginas publicadas com link próprio",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground/80">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-foreground text-background p-10 shadow-card">
              <p className="text-5xl font-black">+38%</p>
              <p className="mt-2 text-background/70">de aumento médio na taxa de conversão de leads em comparação a formulários estáticos.</p>
              <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl bg-background/10 p-4">
                  <p className="text-2xl font-bold">2 min</p>
                  <p className="text-background/70">para criar um funil</p>
                </div>
                <div className="rounded-xl bg-background/10 p-4">
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-background/70">linhas de código</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20">
          <div className="rounded-3xl bg-primary text-primary-foreground p-12 md:p-16 text-center shadow-card">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Pronto para multiplicar suas conversões?</h2>
            <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">Crie sua conta grátis e publique seu primeiro funil em minutos.</p>
            <Button asChild size="lg" variant="secondary" className="mt-8 rounded-full font-semibold h-12 px-8">
              <Link to="/cadastro">Começar agora</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
