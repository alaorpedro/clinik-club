import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Clinik.Club" },
      { name: "description", content: "Fale com a equipe da Clinik.Club. Tire dúvidas, peça uma demo ou negocie planos." },
      { property: "og:title", content: "Contato — Clinik.Club" },
      { property: "og:description", content: "Entre em contato com a equipe da Clinik.Club." },
      { property: "og:url", content: "https://clinik.club/contato" },
    ],
    links: [
      { rel: "canonical", href: "https://clinik.club/contato" },
    ],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const [loading, setLoading] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      (e.target as HTMLFormElement).reset();
      toast.success("Mensagem enviada! Responderemos em breve.");
    }, 800);
  }

  return (
    <div className="theme-clinik min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-20 max-w-xl">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">Contato</p>
        <h1 className="mt-2 ck-display text-6xl tracking-tight">Fale com a gente</h1>
        <p className="mt-4 text-muted-foreground">Dúvidas, demonstrações ou suporte — estamos por aqui.</p>
        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">Nome</label>
            <Input id="name" required name="name" placeholder="Seu nome" aria-label="Seu nome" className="ck-input" />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input id="email" required type="email" name="email" placeholder="Seu email" aria-label="Seu email" className="ck-input" />
          </div>
          <div>
            <label htmlFor="message" className="text-sm font-medium">Mensagem</label>
            <Textarea id="message" required name="message" placeholder="Como podemos ajudar?" aria-label="Como podemos ajudar?" rows={5} className="ck-input" />
          </div>
          <Button type="submit" disabled={loading} size="lg" className="ck-btn font-semibold w-full">
            {loading ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}