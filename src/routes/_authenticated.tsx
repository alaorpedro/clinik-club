import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutGrid, User, LogOut, Loader2, Users, ShieldCheck, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/clinik-club-logo.png";
import icon from "@/assets/clinik-icon.png";

async function getCurrentUserWithFallback() {
  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 2500)),
    ]);
    if (result?.data.user) return result.data.user;
  } catch {
    // Fall back to the local session below so private browsing never gets stuck loading.
  }
  const sessionResult = await Promise.race([
    supabase.auth.getSession(),
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1000)),
  ]);
  return sessionResult?.data.session?.user ?? null;
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const user = await getCurrentUserWithFallback();
    if (!user) throw redirect({ to: "/login", search: { next: location.pathname } as never });
    // Note: plan check happens inside individual app pages (e.g. funnel creation),
    // so users can explore the dashboard and see a clear CTA to activate a plan.
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return null;

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const links = [
    { to: "/app", label: "Meus funis", icon: LayoutGrid },
    { to: "/app/crm", label: "CRM", icon: Users },
    { to: "/app/conta", label: "Minha conta", icon: User },
    ...(isAdmin
      ? [
          { to: "/app/admin", label: "Admin", icon: ShieldCheck },
          { to: "/app/cupons", label: "Cupons", icon: Tag },
        ]
      : []),
  ];

  return (
    <div className="h-screen flex bg-secondary/30 overflow-hidden">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-background p-5 h-screen sticky top-0">
        <a href="/" className="flex items-center gap-2 mb-8" aria-label="Clinik.Club">
          <img src={icon} alt="" className="h-8 w-8" />
          <img src={logo} alt="Clinik.Club" className="h-7 w-auto" />
        </a>
        <nav className="flex-1 space-y-1">
          {links.map((l) => {
            const active = l.to === "/app" ? path === "/app" : path.startsWith(l.to);
            return (
              <a key={l.to} href={l.to} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-secondary"}`}>
                <l.icon className="h-4 w-4" />{l.label}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-border pt-4">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start gap-2"><LogOut className="h-4 w-4" />Sair</Button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden flex items-center justify-between gap-2 border-b border-border bg-background px-4 py-3 sticky top-0 z-30">
          <a href="/" className="flex items-center gap-2" aria-label="Clinik.Club">
            <img src={icon} alt="" className="h-7 w-7" />
            <img src={logo} alt="Clinik.Club" className="h-6 w-auto" />
          </a>
          <nav className="flex items-center gap-1">
            {links.map((l) => {
              const active = l.to === "/app" ? path === "/app" : path.startsWith(l.to);
              return (
                <a key={l.to} href={l.to} aria-label={l.label} className={`flex items-center justify-center h-9 w-9 rounded-lg transition ${active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-secondary"}`}>
                  <l.icon className="h-4 w-4" />
                </a>
              );
            })}
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sair" className="h-9 w-9"><LogOut className="h-4 w-4" /></Button>
          </nav>
        </header>
        <main className="flex-1 p-6 md:p-10 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}