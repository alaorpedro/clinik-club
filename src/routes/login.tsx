import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ptValidation } from "@/lib/validation-messages";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Clinik.Club" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  const nextPath = next?.startsWith("/") ? next : "/app";
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      toast.error("Preencha email e senha para entrar.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }
      window.location.assign(nextPath);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + nextPath });
      if (result.error) toast.error("Erro ao entrar com Google");
      if (!result.redirected && !result.error) window.location.assign(nextPath);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <h1 className="text-4xl font-black tracking-tight">Entrar</h1>
        <p className="mt-2 text-muted-foreground">
          {nextPath.startsWith("/app")
            ? "Entre para acessar o app. Depois disso, você poderá escolher seu plano."
            : "Acesse sua conta Clinik.Club."}
        </p>
        <Button type="button" variant="outline" className="mt-8 w-full rounded-full h-11" onClick={google} disabled={googleLoading || loading}>
          {googleLoading ? "Abrindo Google..." : "Entrar com Google"}
        </Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="flex-1 h-px bg-border" />ou<div className="flex-1 h-px bg-border" /></div>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" className="mt-1.5" {...ptValidation("email")} /></div>
          <div><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" className="mt-1.5" {...ptValidation("senha")} /></div>
          <Button type="submit" disabled={loading || googleLoading} className="w-full rounded-full h-11 font-semibold">{loading ? "Entrando..." : "Entrar"}</Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Não tem conta? <Link to="/cadastro" search={next ? ({ next } as never) : undefined} className="text-primary font-medium">Cadastre-se</Link>
        </p>
        <p className="mt-2 text-sm text-center"><Link to="/reset-password" className="text-muted-foreground hover:text-foreground">Esqueci minha senha</Link></p>
      </main>
    </div>
  );
}