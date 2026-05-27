import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutGrid, User, LogOut, Loader2 } from "lucide-react";


export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return null;

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const links = [
    { to: "/app", label: "Meus funis", icon: LayoutGrid },
    { to: "/app/conta", label: "Minha conta", icon: User },
  ];

  return (
    <div className="h-screen flex bg-secondary/30 overflow-hidden">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-background p-5 h-screen sticky top-0">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <span className="text-lg font-bold">Clinik<span className="text-primary">.Club</span></span>
        </Link>
        <nav className="flex-1 space-y-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${path === l.to ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-secondary"}`}>
              <l.icon className="h-4 w-4" />{l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border pt-4">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user.email}</div>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start gap-2"><LogOut className="h-4 w-4" />Sair</Button>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen"><Outlet /></main>
    </div>
  );
}