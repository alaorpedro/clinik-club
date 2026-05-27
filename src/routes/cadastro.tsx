import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro")({
  head: () => ({ meta: [{ title: "Cadastre-se — Clinik.Club" }] }),
  component: CadastroPage,
});

function CadastroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin + "/app",
        data: { name: String(fd.get("name")) },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cadastro realizado! Verifique seu email para confirmar.");
    navigate({ to: "/login" });
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
    if (result.error) toast.error("Erro ao cadastrar com Google");
    if (!result.redirected && !result.error) navigate({ to: "/app" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <h1 className="text-4xl font-black tracking-tight">Criar conta</h1>
        
        <Button variant="outline" className="mt-8 w-full rounded-full h-11" onClick={google}>Cadastrar com Google</Button>
        <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><div className="flex-1 h-px bg-border" />ou<div className="flex-1 h-px bg-border" /></div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div><Label htmlFor="name">Nome</Label><Input id="name" name="name" required className="mt-1.5" /></div>
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="mt-1.5" /></div>
          <div><Label htmlFor="password">Senha</Label><Input id="password" name="password" type="password" minLength={6} required className="mt-1.5" /></div>
          <Button type="submit" disabled={loading} className="w-full rounded-full h-11 font-semibold">{loading ? "Criando..." : "Criar conta"}</Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary font-medium">Entrar</Link>
        </p>
      </main>
    </div>
  );
}