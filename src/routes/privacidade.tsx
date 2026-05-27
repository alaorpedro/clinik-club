import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ShieldCheck, Lock, Database, Eye, UserCheck, Mail, FileText } from "lucide-react";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Clinik.Club" },
      { name: "description", content: "Como a Clinik.Club coleta, usa e protege seus dados, em conformidade com a LGPD." },
      { property: "og:title", content: "Política de Privacidade — Clinik.Club" },
      { property: "og:description", content: "Transparência total sobre como tratamos seus dados na Clinik.Club." },
    ],
    links: [
      { rel: "canonical", href: "https://kindred-ignite-forge.lovable.app/privacidade" },
    ],
  }),
  component: PrivacidadePage,
});

const pillars = [
  {
    Icon: Lock,
    title: "Criptografia ponta a ponta",
    text: "Dados em trânsito por TLS 1.2+ e dados em repouso protegidos com AES-256.",
  },
  {
    Icon: Database,
    title: "Mínimo necessário",
    text: "Coletamos apenas o que é essencial para o funcionamento dos funis e da sua conta.",
  },
  {
    Icon: UserCheck,
    title: "Você no controle",
    text: "Acesso, correção, portabilidade e exclusão sob demanda, conforme a LGPD.",
  },
];

const sections = [
  {
    id: "dados",
    title: "1. Quais dados coletamos",
    body: (
      <>
        <p>
          Coletamos apenas o necessário para operar a plataforma: nome, e-mail e
          telefone (cadastro), respostas dos funis criados por você, dados de uso
          (logs, dispositivo, navegador) e informações de cobrança quando aplicável.
        </p>
        <p className="mt-3">
          Os leads capturados pelos seus funis pertencem a você — atuamos apenas como
          operadores desses dados.
        </p>
      </>
    ),
  },
  {
    id: "finalidade",
    title: "2. Para quê usamos seus dados",
    body: (
      <ul className="mt-1 space-y-2 list-disc list-inside text-foreground/80">
        <li>Prestar o serviço contratado e operar sua conta;</li>
        <li>Enviar comunicações transacionais (recuperação de senha, recibos);</li>
        <li>Melhorar a plataforma com base em métricas de uso agregadas;</li>
        <li>Cumprir obrigações legais, regulatórias e fiscais.</li>
      </ul>
    ),
  },
  {
    id: "base-legal",
    title: "3. Base legal (LGPD)",
    body: (
      <>
        Tratamos seus dados com base na execução de contrato (art. 7º, V), no
        cumprimento de obrigação legal (art. 7º, II), no legítimo interesse para
        segurança e melhoria do serviço (art. 7º, IX) e no consentimento (art. 7º, I)
        quando aplicável.
      </>
    ),
  },
  {
    id: "compartilhamento",
    title: "4. Com quem compartilhamos",
    body: (
      <>
        Compartilhamos dados apenas com subprocessadores essenciais — provedores de
        infraestrutura em nuvem, serviços de envio de e-mail, gateways de pagamento e
        ferramentas de monitoramento — sempre sob contrato com cláusulas de proteção
        de dados. Nunca vendemos seus dados a terceiros.
      </>
    ),
  },
  {
    id: "retencao",
    title: "5. Por quanto tempo guardamos",
    body: (
      <>
        Mantemos seus dados pelo tempo em que sua conta estiver ativa e pelo prazo
        legal subsequente (em geral, até 5 anos para obrigações fiscais). Após esse
        período, os dados são anonimizados ou excluídos com segurança.
      </>
    ),
  },
  {
    id: "seguranca",
    title: "6. Como protegemos seus dados",
    body: (
      <>
        Aplicamos controles técnicos e organizacionais: criptografia em trânsito e em
        repouso, controle de acesso por princípio do menor privilégio, autenticação
        em duas etapas para equipe interna, monitoramento contínuo e testes regulares
        de segurança.
      </>
    ),
  },
  {
    id: "direitos",
    title: "7. Seus direitos como titular",
    body: (
      <ul className="mt-1 space-y-2 list-disc list-inside text-foreground/80">
        <li>Confirmar a existência de tratamento dos seus dados;</li>
        <li>Acessar, corrigir e atualizar seus dados;</li>
        <li>Solicitar portabilidade ou anonimização;</li>
        <li>Revogar o consentimento e solicitar a exclusão;</li>
        <li>Reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
    ),
  },
  {
    id: "cookies",
    title: "8. Cookies",
    body: (
      <>
        Usamos cookies essenciais para manter sua sessão e cookies analíticos para
        entender como a plataforma é utilizada. Você pode gerenciar preferências no
        navegador a qualquer momento.
      </>
    ),
  },
  {
    id: "encarregado",
    title: "9. Encarregado de Dados (DPO)",
    body: (
      <>
        Para exercer qualquer direito ou esclarecer dúvidas sobre o tratamento dos
        seus dados, fale com nosso Encarregado pelo e-mail{" "}
        <a href="mailto:dpo@clinik.club" className="text-primary hover:underline">
          dpo@clinik.club
        </a>
        .
      </>
    ),
  },
];

function PrivacidadePage() {
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
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              100% LGPD · Atualizado em 27/05/2026
            </div>
            <h1 className="mt-4 text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
              Sua{" "}
              <span className="relative inline-block">
                <span className="relative z-10">privacidade</span>
                <span className="absolute inset-x-0 bottom-1 h-3 bg-highlight -z-0 -skew-x-3" />
              </span>
              <br />
              é prioridade.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              Esta política explica, em linguagem clara, como coletamos, usamos e
              protegemos seus dados — e os dados dos pacientes que passam pelos seus
              funis.
            </p>

            {/* Pillars */}
            <div className="mt-10 grid sm:grid-cols-3 gap-4">
              {pillars.map(({ Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="grid lg:grid-cols-[240px_1fr] gap-12">
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

            <article className="space-y-10">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
                  <div className="mt-3 text-foreground/80 leading-relaxed">{s.body}</div>
                </section>
              ))}

              <div className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <Eye className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">Quer exercer um direito?</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Envie sua solicitação para{" "}
                      <a href="mailto:dpo@clinik.club" className="text-primary hover:underline">
                        dpo@clinik.club
                      </a>
                      . Respondemos em até 15 dias, conforme a LGPD.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4 text-sm">
                <Link
                  to="/termos"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-medium hover:border-primary hover:text-primary transition"
                >
                  <FileText className="h-4 w-4" />
                  Ler Termos de uso
                </Link>
                <Link
                  to="/contato"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-medium hover:border-primary hover:text-primary transition"
                >
                  <Mail className="h-4 w-4" />
                  Falar com o time
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