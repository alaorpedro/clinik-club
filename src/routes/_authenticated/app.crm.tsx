import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/crm")({
  component: CrmPage,
});

function CrmPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight">CRM</h1>
        <p className="text-muted-foreground mt-1">Gerencie seus leads e acompanhe o pipeline de vendas.</p>
      </div>
      <div className="rounded-3xl border-2 border-dashed border-border bg-background p-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-xl font-bold">Em breve</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Estamos preparando seu CRM. Em breve você poderá organizar leads em colunas (Novo, Em contato, Agendado, Fechado), adicionar anotações e acompanhar o histórico de cada contato.
        </p>
      </div>
    </div>
  );
}