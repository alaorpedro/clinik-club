import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { deleteOwnAccount } from "@/lib/account.functions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/conta")({
  component: ContaPage,
});

function ContaPage() {
  const [profile, setProfile] = useState<{ name: string | null; plan: string } | null>(null);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email ?? "");
      const [{ data }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("name, plan").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle(),
      ]);
      setIsAdmin(!!role);
      setProfile(data ?? { name: "", plan: "free" });
    })();
  }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("profiles").update({ name: String(fd.get("name")) }).eq("id", u.user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
  }

  async function openPortal() {
    setOpeningPortal(true);
    try {
      const result = await createPortalSession({
        data: { environment: getStripeEnvironment(), returnUrl: window.location.href },
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        window.open(result.url, "_blank");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir portal");
    } finally {
      setOpeningPortal(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const result = await deleteOwnAccount();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir conta");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const hasPaidPlan = !isAdmin && profile?.plan && profile.plan !== "free";
  const planLabel = isAdmin ? "agency liberado" : profile?.plan ?? "free";

  return (
    <div className="max-w-xl">
      <h1 className="text-3xl font-black tracking-tight">Minha conta</h1>
      <p className="text-muted-foreground mt-1">Gerencie seu perfil e assinatura.</p>
      {profile && (
        <form onSubmit={save} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div><Label>Email</Label><Input value={email} disabled className="mt-1.5" /></div>
          <div><Label htmlFor="name">Nome</Label><Input id="name" name="name" defaultValue={profile.name ?? ""} className="mt-1.5" /></div>
          <Button type="submit" disabled={saving} className="rounded-full font-semibold">{saving ? "Salvando..." : "Salvar"}</Button>
        </form>
      )}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-bold">Plano atual</h2>
        <p className="mt-1 text-sm text-muted-foreground">Você está no plano <strong className="text-foreground capitalize">{planLabel}</strong>.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isAdmin ? (
            <Button variant="outline" className="rounded-full" disabled>
              Acesso admin liberado
            </Button>
          ) : hasPaidPlan ? (
            <Button variant="outline" className="rounded-full" onClick={openPortal} disabled={openingPortal}>
              {openingPortal ? "Abrindo..." : "Gerenciar assinatura"}
            </Button>
          ) : (
            <Button asChild className="rounded-full font-semibold">
              <a href="/planos">Ver planos</a>
            </Button>
          )}
        </div>
      </div>
      <div className="mt-8 rounded-2xl border border-destructive/30 bg-card p-6">
        <h2 className="font-bold text-destructive">Excluir minha conta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta ação cancela assinaturas ativas e remove sua conta e seus dados do sistema.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4 rounded-full font-semibold"
          onClick={() => setDeleteOpen(true)}
        >
          Excluir minha conta
        </Button>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Suas assinaturas ativas serão canceladas e sua conta será removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                deleteAccount();
              }}
            >
              {deleting ? "Excluindo..." : "Excluir conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
