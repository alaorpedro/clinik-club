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
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-20 max-w-xl">
        <p className="text-sm font-semibold text-primary uppercase tracking-wide">Contato</p>
        <h1 className="mt-2 text-5xl font-black tracking-tight">Fale com a gente</h1>
        <p className="mt-4 text-muted-foreground">Dúvidas, demonstrações ou suporte — estamos por aqui.</p>
        <form onSubmit={onSubmit} className="mt-10 space-y-4">
          <Input required name="name" placeholder="Seu nome" />
          <Input required type="email" name="email" placeholder="Seu email" />
          <Textarea required name="message" placeholder="Como podemos ajudar?" rows={5} />
          <Button type="submit" disabled={loading} size="lg" className="rounded-full font-semibold w-full">
            {loading ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}