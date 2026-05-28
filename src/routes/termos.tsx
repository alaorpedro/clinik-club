import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FileText, ShieldCheck, Scale, Mail } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Clinik.Club" },
      { name: "description", content: "Termos de uso da plataforma Clinik.Club: regras, responsabilidades e condições de utilização." },
      { property: "og:title", content: "Termos de uso — Clinik.Club" },
      { property: "og:description", content: "Leia os termos que regem o uso da plataforma Clinik.Club." },
      { property: "og:url", content: "https://clinik.club/termos" },
    ],
    links: [
      { rel: "canonical", href: "https://clinik.club/termos" },
    ],
  }),
  component: TermosPage,
});

const sections = [
  {
    id: "aceitacao",
    title: "1. Aceitação dos termos",
    body: (
      <>
        Ao criar uma conta ou utilizar a Clinik.Club, você concorda com estes Termos
        de uso e com a nossa{" "}
        <Link to="/privacidade" className="text-primary underline-offset-4 hover:underline">
          Política de Privacidade
        </Link>
        . Se você não concorda com qualquer parte, não utilize a plataforma.
      </>
    ),
  },
  {
    id: "conta",
    title: "2. Conta e responsabilidade",
    body: (
      <>
        Você é responsável por manter a confidencialidade das credenciais de acesso e
        por todas as atividades realizadas em sua conta. Notifique-nos imediatamente
        em caso de uso não autorizado.
      </>
    ),
  },
  {
    id: "uso",
    title: "3. Uso aceitável",
    body: (
      <>
        A plataforma destina-se à criação de funis interativos para clínicas e
        profissionais da saúde. É proibido utilizá-la para envio de spam, conteúdo
        ilícito, violação de direitos de terceiros ou qualquer atividade contrária
        à legislação brasileira.
      </>
    ),
  },
  {
    id: "planos",
    title: "4. Planos, pagamentos e cancelamento",
    body: (
      <>
        Os planos pagos são cobrados de forma recorrente, conforme a periodicidade
        contratada. Você pode cancelar a qualquer momento pela área da sua conta —
        o acesso permanece ativo até o fim do ciclo já pago.
      </>
    ),
  },
  {
    id: "propriedade",
    title: "5. Propriedade intelectual",
    body: (
      <>
        O software, marca, layout e materiais da Clinik.Club são protegidos por lei.
        O conteúdo que você cria (funis, perguntas, leads) permanece de sua titularidade
        e nós atuamos apenas como operadores para viabilizar o serviço.
      </>
    ),
  },
  {
    id: "limitacao",
    title: "6. Limitação de responsabilidade",
    body: (
      <>
        A Clinik.Club não se responsabiliza por decisões clínicas, diagnósticos ou
        condutas baseadas exclusivamente em informações coletadas via funis. A
        plataforma é uma ferramenta de qualificação e agendamento, não substitui
        avaliação profissional.
      </>
    ),
  },
  {
    id: "rescisao",
    title: "7. Rescisão",
    body: (
      <>
        Podemos suspender ou encerrar contas que violem estes Termos. Você também
        pode encerrar sua conta a qualquer momento. Após o encerramento, os dados
        são tratados conforme nossa Política de Privacidade e a LGPD.
      </>
    ),
  },
  {
    id: "alteracoes",
    title: "8. Alterações destes termos",
    body: (
      <>
        Podemos atualizar estes Termos periodicamente. Quando isso ocorrer, avisaremos
        por e-mail ou pela plataforma. O uso continuado após a alteração representa
        a sua concordância com a nova versão.
      </>
    ),
  },
  {
    id: "lei",
    title: "9. Lei aplicável e foro",
    body: (
      <>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica
        eleito o foro da comarca de São Paulo/SP para dirimir quaisquer controvérsias.
      </>
    ),
  },
];

function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent/30 blur-3xl" aria-hidden />
          <div className="container relative mx-auto px-4 py-16 lg:py-20 max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Scale className="h-3.5 w-3.5 text-primary" />
              Documento legal · Atualizado em 27/05/2026
            </div>
            <h1 className="mt-4 text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
              Termos de <span className="relative inline-block">
                <span className="relative z-10">uso</span>
                <span className="absolute inset-x-0 bottom-1 h-3 bg-highlight -z-0 -skew-x-3" />
              </span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              Estas são as regras que definem como você e a Clinik.Club se relacionam ao
              usar nossa plataforma. Escritas de forma direta para você entender sem
              precisar de advogado.
            </p>
          </div>
        </section>

        {/* Content with sticky TOC */}
        <section className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="grid lg:grid-cols-[240px_1fr] gap-12">
            {/* TOC */}
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                  Nesta página
                </p>
                <nav className="space-y-2 text-sm">
                  {sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      className="block text-muted-foreground hover:text-primary transition"
                    >
                      {s.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Sections */}
            <article className="space-y-10">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
                  <p className="mt-3 text-foreground/80 leading-relaxed">{s.body}</p>
                </section>
              ))}

              {/* Contact card */}
              <div className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Mail className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">Dúvidas sobre estes termos?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Fale com nosso time pelo e-mail{" "}
                      <a href="mailto:legal@clinik.club" className="text-primary hover:underline">
                        legal@clinik.club
                      </a>{" "}
                      ou acesse a página de{" "}
                      <Link to="/contato" className="text-primary hover:underline">
                        contato
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 text-sm">
                <Link
                  to="/privacidade"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-medium hover:border-primary hover:text-primary transition"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Ler Política de Privacidade
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-medium hover:border-primary hover:text-primary transition"
                >
                  <FileText className="h-4 w-4" />
                  Voltar ao início
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}