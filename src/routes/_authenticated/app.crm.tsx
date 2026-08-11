import {
  createFileRoute,
  Outlet,
  Link,
  useRouterState,
  Navigate,
  useNavigate,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  LayoutGrid,
  MessageSquare,
  ListChecks,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";
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

  // Only handle redirects if we are actually on a CRM route
  const normalizedPath = path.replace(/\/$/, "");
  const isCrmPath = normalizedPath.startsWith("/app/crm");
  const isUpgradePage = normalizedPath === "/app/crm/upgrade";

  if (isCrmPath && !data?.hasAccess && !isUpgradePage) {
    return <Navigate to="/app/crm/upgrade" replace />;
  }

  if (isCrmPath && data?.hasAccess && isUpgradePage) {
    return <Navigate to="/app/crm/pipelines" replace />;
  }

  if (isUpgradePage) {
    return (
      <div className="flex-1">
        <Outlet />
      </div>
    );
  }

  const links = [
    { to: "/app/crm/pipelines", label: "Pipeline", icon: LayoutGrid },
    { to: "/app/crm/atendimento", label: "Atendimento", icon: MessageSquare },
    { to: "/app/crm/leads", label: "Leads", icon: ListChecks },
    { to: "/app/crm/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/app/crm/configuracoes", label: "Configurações", icon: SettingsIcon },
  ] as const;

  return (
    <div className="flex flex-col min-h-full">
      {/* Abas horizontais, nunca uma segunda barra lateral — o kanban precisa da
       * largura inteira da tela; duas colunas de nav lado a lado não sobra espaço
       * pras etapas do pipeline (ver docs/crm-plano.md, Fase 1). */}
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border bg-background/60 px-6 lg:px-10 no-scrollbar">
        {links.map((l) => {
          const active = path === l.to || path.startsWith(l.to);
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap cursor-pointer border-b-2 -mb-px transition-colors duration-[180ms] ease-out ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-foreground/60 hover:text-foreground hover:border-border"
              }`}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1 p-6 lg:p-10">
        <Outlet />
      </div>
    </div>
  );
}
