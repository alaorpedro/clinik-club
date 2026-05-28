import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/crm/relatorios")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground mt-1 text-sm">Análise de conversão, origem e leads parados.</p>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border p-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Em construção</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
          Logo aqui você verá conversão por etapa, leads parados, origem das campanhas e poderá exportar tudo em XLSX.
        </p>
      </div>
    </div>
  );
}