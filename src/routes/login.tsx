import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Click.Club" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")), password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/app" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (result.error) toast.error("Erro ao entrar com Google");
    if (!result.redirected && !result.error) navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <h1 className="text-4xl font-black tracking-tight">Entrar</h1>
        <p className="mt-2 text-muted-foreground">Acesse sua conta Click.Club.</p>
        <Button variant="outline" className="mt-8 w-full rounded-full h-11" onClick={google}>Entrar com Google</Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="flex-1 h-px bg-border" />ou<div className="flex-1 h-px bg-border" /></div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="mt-1.5" /></div>
          <div><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" required className="mt-1.5" /></div>
          <Button type="submit" disabled={loading} className="w-full rounded-full h-11 font-semibold">{loading ? "Entrando..." : "Entrar"}</Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Não tem conta? <Link to="/cadastro" className="text-primary font-medium">Cadastre-se</Link>
        </p>
        <p className="mt-2 text-sm text-center"><Link to="/reset-password" className="text-muted-foreground hover:text-foreground">Esqueci minha senha</Link></p>
      </main>
    </div>
  );
}