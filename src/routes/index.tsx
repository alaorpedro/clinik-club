import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { QuizMockup } from "@/components/site/QuizMockup";
import { Button } from "@/components/ui/button";
import {
  Check,
  Zap,
  BarChart3,
  MousePointer2,
  ShieldCheck,
  CalendarCheck,
  Stethoscope,
  Smile,
  Sparkles,
  HeartPulse,
  Baby,
} from "lucide-react";
import { ToothMark } from "@/components/site/ToothMark";

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
          {/* Organic dental blobs */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute top-40 -left-32 h-80 w-80 rounded-full bg-accent/30 blur-3xl" aria-hidden />
          <div className="container mx-auto px-4 py-4 lg:py-6 grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Feito para clínicas odontológicas <span className="text-foreground/40">—</span> 100% LGPD
              </div>
              <h1 className="mt-3 text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
                Mais sorrisos agendados,{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">menos cadeira vazia</span>
                  <span className="absolute inset-x-0 bottom-1 h-4 bg-highlight -z-0 -skew-x-3" />
                </span>.
              </h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl">
                A <strong className="text-foreground">Clinik.Club</strong> transforma visitantes em <strong className="text-foreground">pacientes agendados</strong> com funis interativos pensados para clareamento, implantes, ortodontia e mais.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="rounded-full font-semibold h-12 px-6">
                  <Link to="/cadastro">Começar grátis</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full font-semibold h-12 px-6">
                  <Link to="/planos">Ver planos</Link>
                </Button>
              </div>
              {/* Trust badges */}
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Conformidade LGPD</span>
                <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-4 w-4 text-primary" /> Validado por dentistas</span>
                <span className="inline-flex items-center gap-1.5"><CalendarCheck className="h-4 w-4 text-primary" /> Integra com sua agenda</span>
              </div>
            </div>
            <div className="lg:pl-8">
              <QuizMockup />
            </div>
          </div>
        </section>

        {/* Confiam na Clinik.Club */}
        <section className="border-y border-border/60 bg-secondary/40 py-8">
          <div className="container mx-auto px-4">
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">Clínicas que já usam Clinik.Club</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-muted-foreground/70 font-semibold">
              {[
                "OdontoVida",
                "Sorriso Perfeito",
                "Clínica Bertola",
                "Dentalmed",
                "Orto Center",
                "Clínica Aliança",
                "Smile House",
                "Implante & Cia",
              ].map((n) => (
                <span key={n} className="text-base">{n}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Como funciona</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-black tracking-tight">3 passos para encher sua agenda</h2>
          </div>
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {[
              { icon: MousePointer2, title: "1. Escolha um template", desc: "Comece de um quiz pronto por especialidade — clareamento, implante, ortodontia." },
              { icon: Zap, title: "2. Publique e divulgue", desc: "Link próprio pronto pra Instagram, WhatsApp e anúncios da clínica." },
              { icon: BarChart3, title: "3. Atenda mais pacientes", desc: "Receba os dados qualificados direto no seu WhatsApp ou agenda." },
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

        {/* Templates por especialidade */}
        <section className="container mx-auto px-4 pb-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Templates prontos</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-black tracking-tight">Funis por especialidade odontológica</h2>
            <p className="mt-4 text-muted-foreground">Cada template traz as perguntas certas para qualificar o paciente ideal.</p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Sparkles, title: "Clareamento dental", desc: "Qualifica desejo estético, sensibilidade e expectativa de resultado." },
              { icon: ToothMark, title: "Implantes", desc: "Identifica perda dentária, tempo sem dente e orçamento disponível." },
              { icon: Smile, title: "Ortodontia / Alinhadores", desc: "Triagem entre aparelho fixo, autoligado e alinhadores invisíveis." },
              { icon: HeartPulse, title: "Limpeza e prevenção", desc: "Reativa pacientes inativos com check-up periódico." },
              { icon: Baby, title: "Odontopediatria", desc: "Conversa com pais com linguagem leve e acolhedora." },
              { icon: Stethoscope, title: "Harmonização orofacial", desc: "Filtra leads pelo tipo de procedimento e região tratada." },
            ].map((t) => (
              <div key={t.title} className="group rounded-2xl border border-border bg-card p-6 shadow-soft hover:shadow-card transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/30 text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold">{t.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{t.desc}</p>
                <p className="mt-4 text-xs font-semibold text-primary">Usar template →</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recursos */}
        <section className="bg-secondary/40 py-20">
          <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight">Tudo que sua clínica precisa em <span className="text-primary">um só lugar</span></h2>
              <ul className="mt-8 space-y-4">
                {[
                  "Builder visual drag-and-drop — sem código",
                  "Qualificação automática por especialidade",
                  "Notificações no WhatsApp da recepção",
                  "Analytics por etapa: onde o paciente desiste",
                  "Conformidade LGPD com consentimento explícito",
                  "Página publicada com link próprio da clínica",
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
              <p className="mt-2 text-background/70">de aumento médio em agendamentos vs. formulários estáticos de contato.</p>
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

        {/* FAQ odonto */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Perguntas frequentes</p>
            <h2 className="mt-2 text-4xl md:text-5xl font-black tracking-tight">Dúvidas comuns de dentistas</h2>
          </div>
          <div className="mt-12 max-w-3xl mx-auto grid gap-4">
            {[
              {
                q: "Preciso ter conhecimento técnico para usar?",
                a: "Não. Os funis são montados visualmente, com templates prontos por especialidade odontológica. Você só personaliza o texto e a marca da clínica.",
              },
              {
                q: "Está em conformidade com a LGPD e o CFO?",
                a: "Sim. Coletamos consentimento explícito do paciente, não usamos linguagem promissória e respeitamos as diretrizes de publicidade odontológica do CFO.",
              },
              {
                q: "Os leads chegam onde?",
                a: "Direto no WhatsApp da recepção, por e-mail e no painel da Clinik.Club. Também integramos com sua agenda ou CRM.",
              },
              {
                q: "Funciona para clínica com vários dentistas?",
                a: "Sim — você cria funis por especialidade ou por profissional e distribui os leads automaticamente.",
              },
            ].map((f) => (
              <details key={f.q} className="group rounded-2xl border border-border bg-card p-5 shadow-soft">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="text-primary group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20">
          <div className="rounded-3xl bg-primary text-primary-foreground p-12 md:p-16 text-center shadow-card">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">Pronto para encher sua agenda?</h2>
            <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">Crie sua conta grátis e publique o funil da sua clínica em minutos.</p>
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
