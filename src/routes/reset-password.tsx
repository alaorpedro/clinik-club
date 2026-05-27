import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Clinik.Club" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [recovery, setRecovery] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) setRecovery(true);
  }, []);

  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.resetPasswordForEmail(String(fd.get("email")), {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Link de redefinição enviado para seu email.");
  }

  async function updatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.auth.updateUser({ password: String(fd.get("password")) });
    setLoading(false);
    if (error) {
      const msg = error.message;
      if (msg.toLowerCase().includes("weak and easy to guess") || msg.toLowerCase().includes("password is known")) {
        toast.error("Essa senha é muito comum e já apareceu em vazamentos de dados. Escolha uma senha mais segura, combinando letras maiúsculas, minúsculas, números e símbolos.");
      } else {
        toast.error(msg);
      }
    }
    else { toast.success("Senha atualizada!"); window.location.href = "/app"; }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <h1 className="text-4xl font-black tracking-tight">{recovery ? "Nova senha" : "Recuperar senha"}</h1>
        {recovery ? (
          <form onSubmit={updatePassword} className="mt-8 space-y-4">
            <div><Label htmlFor="password">Nova senha</Label><Input id="password" name="password" type="password" minLength={6} required className="mt-1.5" /></div>
            <Button type="submit" disabled={loading} className="w-full rounded-full h-11 font-semibold">Atualizar senha</Button>
          </form>
        ) : (
          <form onSubmit={requestReset} className="mt-8 space-y-4">
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required className="mt-1.5" /></div>
            <Button type="submit" disabled={loading} className="w-full rounded-full h-11 font-semibold">Enviar link</Button>
          </form>
        )}
      </main>
    </div>
  );
}