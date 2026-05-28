import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/crm/configuracoes")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1 text-sm">Pipelines, etapas e atendentes.</p>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border p-16 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-bold">Em breve</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
          Personalização de pipelines, etapas e convite de atendentes chegam no próximo update.
        </p>
      </div>
    </div>
  );
}