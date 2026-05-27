import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Click.Club" },
      { name: "description", content: "Conheça a Click.Club: a plataforma de funis interativos para clínicas e profissionais da saúde." },
      { property: "og:title", content: "Sobre — Click.Club" },
      { property: "og:description", content: "Conheça a história e missão da Click.Club." },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-20 max-w-3xl">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">Sobre nós</p>
        <h1 className="mt-2 text-5xl font-black tracking-tight">Pioneira em funis interativos no Brasil</h1>
        <div className="mt-8 space-y-5 text-lg text-foreground/80 leading-relaxed">
          <p>A <strong>Click.Club</strong> nasceu para resolver um problema simples: formulários estáticos convertem mal. A maior parte do tráfego pago é desperdiçada porque o lead chega na página e não se sente engajado.</p>
          <p>Trazemos a experiência de quiz — interativa, leve e personalizada — para o funil de vendas de clínicas, consultórios e profissionais da saúde. O resultado é mais leads qualificados, com mais informação e maior intenção de compra.</p>
          <p>Hoje processamos milhares de respostas por dia e ajudamos profissionais a transformar visitas em pacientes reais.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}