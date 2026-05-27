import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-3xl border border-border bg-card p-10 text-center shadow-card">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-highlight flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-foreground" />
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">Pagamento confirmado!</h1>
        <p className="mt-3 text-muted-foreground">
          {session_id
            ? "Sua assinatura está ativa. Em segundos seu plano será atualizado."
            : "Verificando sua sessão..."}
        </p>
        <Button asChild className="mt-8 w-full rounded-full font-semibold">
          <Link to="/app">Ir para o painel</Link>
        </Button>
      </div>
    </div>
  );
}