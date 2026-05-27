import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCheckoutSessionInfo } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  const navigate = useNavigate();
  const [needsAccount, setNeedsAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        navigate({ to: "/app" });
        return;
      }
      if (!session_id) { setChecking(false); return; }
      const info = await getCheckoutSessionInfo({
        data: { sessionId: session_id, environment: getStripeEnvironment() },
      });
      if ("error" in info || !info.email) { setChecking(false); return; }
      setNeedsAccount(info.email);
      setChecking(false);
    })();
  }, [session_id, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-3xl border border-border bg-card p-10 text-center shadow-card">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-highlight flex items-center justify-center">
            {checking ? <Loader2 className="h-8 w-8 text-foreground animate-spin" /> : <CheckCircle2 className="h-8 w-8 text-foreground" />}
          </div>
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">Pagamento confirmado!</h1>
        {needsAccount ? (
          <>
            <p className="mt-3 text-muted-foreground">
              Crie sua senha para acessar o painel. Use o email <span className="font-semibold text-foreground">{needsAccount}</span> usado no pagamento.
            </p>
            <Button asChild className="mt-8 w-full rounded-full font-semibold">
              <Link to="/cadastro" search={{ email: needsAccount, next: "/app" } as never}>Criar conta e acessar</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-muted-foreground">Sua assinatura está ativa. Em segundos seu plano será atualizado.</p>
            <Button asChild className="mt-8 w-full rounded-full font-semibold">
              <Link to="/app">Ir para o painel</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}