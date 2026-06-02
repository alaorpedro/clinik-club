import { createFileRoute, Outlet, Link, useRouterState, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LayoutGrid, ListChecks, BarChart3, Settings as SettingsIcon } from "lucide-react";
import { hasCrmAccess } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/app/crm")({
  component: CrmLayout,
});

function CrmLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const checkAccess = useServerFn(hasCrmAccess);
  const { data, isLoading } = useQuery({
    queryKey: ["crm", "access"],
    queryFn: () => checkAccess(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isUpgradePage = path.includes("/app/crm/upgrade");
  if (!data?.hasAccess && !isUpgradePage) {
    return <Navigate to="/app/crm/upgrade" replace />;
  }
  if (data?.hasAccess && isUpgradePage) {
    return <Navigate to="/app/crm/pipelines" replace />;
  }

  if (isUpgradePage) return (
    <div className="flex-1">
      <Outlet />
    </div>
  );

  const links = [
    { to: "/app/crm/pipelines", label: "Pipeline", icon: LayoutGrid },
    { to: "/app/crm/leads", label: "Leads", icon: ListChecks },
    { to: "/app/crm/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/app/crm/configuracoes", label: "Configurações", icon: SettingsIcon },
  ] as const;



  return (
    <div className="flex flex-col lg:flex-row min-h-full">
      <aside className="lg:w-52 flex flex-col border-r border-border bg-background/60 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 mb-3">CRM</div>
        <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1 lg:space-y-1 no-scrollbar">
          {links.map((l) => {
            const active = path === l.to || path.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap cursor-pointer hover:scale-[1.02] active:scale-95 ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:bg-secondary"
                }`}
              >
                <l.icon className={`h-4 w-4 ${active ? "text-primary-foreground" : "text-primary"}`} />
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 p-6 lg:p-10">
        <Outlet />
      </div>
    </div>

  );
}