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
  head: () => ({
    meta: [
      { title: "Entrar — Clinik.Club" },
      { name: "description", content: "Acesse sua conta Clinik.Club e gerencie seus funis interativos." },
      { property: "og:title", content: "Entrar — Clinik.Club" },
      { property: "og:description", content: "Acesse sua conta Clinik.Club." },
      { property: "og:url", content: "https://clinik.club/login" },
    ],
    links: [
      { rel: "canonical", href: "https://clinik.club/login" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

function safeNextPath(next: string | undefined): string {
  if (!next || typeof next !== "string") return "/app";
  // Must be an internal absolute path. Reject protocol-relative URLs (//evil.com),
  // backslash variants (/\evil.com), and anything that isn't a single-slash path.
  if (!next.startsWith("/")) return "/app";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/app";
  // Reject schemes and control chars just in case.
  if (/[\x00-\x1f]/.test(next)) return "/app";
  return next;
}

function LoginPage() {
  const { next } = Route.useSearch();
  const nextPath = safeNextPath(next);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

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
    setUnconfirmedEmail(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
          setUnconfirmedEmail(email);
          toast.error("Confirme seu email antes de entrar. Verifique sua caixa de entrada.");
        } else if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          toast.error("Email ou senha incorretos.");
        } else {
          toast.error("Não foi possível entrar. Verifique seus dados e tente novamente.");
        }
        return;
      }
      window.location.assign(nextPath);
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!unconfirmedEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: unconfirmedEmail });
      if (error) {
        toast.error("Não foi possível reenviar agora. Tente em alguns instantes.");
        return;
      }
      toast.success("Email de confirmação reenviado. Verifique sua caixa de entrada.");
    } finally {
      setResending(false);
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
        {unconfirmedEmail ? (
          <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <p className="text-foreground">
              Seu email <span className="font-semibold">{unconfirmedEmail}</span> ainda não foi confirmado.
            </p>
            <Button type="button" variant="outline" className="mt-3 w-full rounded-full" onClick={resendConfirmation} disabled={resending}>
              {resending ? "Reenviando..." : "Reenviar email de confirmação"}
            </Button>
          </div>
        ) : null}
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Não tem conta? <Link to="/cadastro" search={next ? ({ next } as never) : undefined} className="text-primary font-medium">Cadastre-se</Link>
        </p>
        <p className="mt-2 text-sm text-center"><Link to="/reset-password" className="text-muted-foreground hover:text-foreground">Esqueci minha senha</Link></p>
      </main>
    </div>
  );
}