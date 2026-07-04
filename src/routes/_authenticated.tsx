import { createFileRoute, Outlet, redirect, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutGrid, User, LogOut, Loader2, Users, ShieldCheck, Tag, Menu, X, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/clinik-club-logo.png";
import icon from "@/assets/clinik-icon.png";



async function getCurrentUserWithFallback() {
  if (typeof window === "undefined") return undefined;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
  } catch (err) {
    console.error("Auth check failed:", err);
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUserWithFallback();
    if (user === undefined) return;
    if (!user) {
      throw redirect({ 
        to: "/login", 
        search: { next: location.pathname } as any
      });
    }
  },
  component: AppLayout,
});



function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("clinik-sidebar-collapsed") === "true";
  });


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

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("clinik-sidebar-collapsed", String(next));
      return next;
    });
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
    <div className="min-h-screen flex flex-col md:flex-row bg-secondary/30 relative isolate">
      {/* Sidebar Desktop */}
      <aside className={`hidden md:flex flex-col border-r border-border bg-background p-4 h-screen sticky top-0 z-[50] transition-[width] duration-200 ${sidebarCollapsed ? "w-20" : "w-64"}`}>
        <div className="mb-8 flex items-center gap-2">
          <Link
            to="/app"
            className={`flex min-w-0 flex-1 items-center gap-2 hover:opacity-80 transition-opacity ${sidebarCollapsed ? "justify-center" : ""}`}
            aria-label="Clinik.Club"
          >
            <img src={icon} alt="" className="h-8 w-8 shrink-0" />
            {!sidebarCollapsed && <img src={logo} alt="Clinik.Club" className="h-7 w-auto min-w-0" />}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 space-y-1">
          {links.map((l) => {
            const active = path === l.to || (l.to !== "/app" && path.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to as any}
                title={sidebarCollapsed ? l.label : undefined}
                className={`w-full flex items-center rounded-lg text-sm font-bold transition cursor-pointer hover:scale-[1.02] active:scale-95 ${sidebarCollapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-2.5"} ${active ? "bg-primary text-primary-foreground shadow-md" : "text-foreground/70 hover:bg-secondary"}`}
              >
                <div className="flex items-center gap-3">
                  <l.icon className={`h-4 w-4 ${active ? "text-primary-foreground" : "text-primary"}`} />
                  {!sidebarCollapsed && l.label}
                </div>
                {active && !sidebarCollapsed && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border pt-4">
          {!sidebarCollapsed && <div className="px-3 py-2 text-[10px] font-medium text-muted-foreground truncate uppercase tracking-wider">{user.email}</div>}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            title={sidebarCollapsed ? "Sair" : undefined}
            className={`w-full gap-2 cursor-pointer font-bold text-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors ${sidebarCollapsed ? "justify-center px-0" : "justify-start"}`}
          >
            <LogOut className="h-4 w-4 text-destructive" />{!sidebarCollapsed && "Sair"}
          </Button>
        </div>
      </aside>


      {/* Header Mobile */}
      <header className="md:hidden flex items-center justify-between border-b border-border bg-background px-4 h-14 sticky top-0 z-[60]">
        <Link 
          to="/app"
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-2" 
          aria-label="Clinik.Club"
        >
          <img src={icon} alt="" className="h-7 w-7" />
          <img src={logo} alt="Clinik.Club" className="h-6 w-auto" />
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="h-9 w-9">
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>


      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-14 bg-background z-[55] flex flex-col p-6 animate-in slide-in-from-top duration-300">
          <nav className="flex-1 space-y-2">
            {links.map((l) => {
              const active = path === l.to || (l.to !== "/app" && path.startsWith(l.to));
              return (
                <Link
                  key={l.to}
                  to={l.to as any}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition ${active ? "bg-primary text-primary-foreground" : "text-foreground/70 bg-secondary/50"}`}
                >
                  <l.icon className="h-5 w-5" />{l.label}
                </Link>
              );
            })}

          </nav>
          <div className="border-t border-border pt-6 mt-auto">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground truncate uppercase tracking-wider mb-2">{user.email}</div>
            <Button variant="outline" size="lg" onClick={logout} className="w-full justify-center gap-2 rounded-xl font-bold border-destructive/20 text-destructive"><LogOut className="h-5 w-5" />Sair</Button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col relative z-0 w-full overflow-x-hidden">
        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-10 z-0">
          <Outlet />
        </main>
      </div>
    </div>

  );
}
