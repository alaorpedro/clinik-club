import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CreditCard, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BoletoSubscriptionForm } from "@/components/BoletoSubscriptionForm";
import {
  getRegularizationStatus,
  type RegularizationStatus,
} from "@/lib/billing-regularize.functions";
import { getStripeEnvironment } from "@/lib/stripe";

const StripeEmbeddedCheckout = lazy(() =>
  import("@/components/StripeEmbeddedCheckout").then((m) => ({
    default: m.StripeEmbeddedCheckout,
  })),
);

// Nomes e valores exibidos — espelho de PlansDialog/planos.tsx (o Stripe é a fonte da verdade).
const PRICE_LABELS: Record<string, { plan: string; amount: string }> = {
  starter_monthly: { plan: "Starter", amount: "R$ 99/mês" },
  starter_yearly: { plan: "Starter", amount: "R$ 950/ano" },
  pro_monthly: { plan: "Pro", amount: "R$ 159/mês" },
  pro_yearly: { plan: "Pro", amount: "R$ 1.526/ano" },
  agency_monthly: { plan: "Agency", amount: "R$ 449/mês" },
  agency_yearly: { plan: "Agency", amount: "R$ 4.310/ano" },
};

// Fechou o popup? Não insiste de novo nesta visita; na próxima abre de novo.
const DISMISS_KEY = "clinik.regularize.dismissed";

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* ignore */
  }
}

// Faixa + popup "Regularize sua assinatura" para toda conta cujo plano caiu
// (cancelado, cobrança falhada, expirado) e não tem outro plano ativo.
// Montado no layout autenticado, então aparece em qualquer tela do /app.
export function RegularizeSubscriptionGate() {
  const getStatus = useServerFn(getRegularizationStatus);
  const [status, setStatus] = useState<RegularizationStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"boleto" | "card">("boleto");
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStatus({ data: { environment: getStripeEnvironment() } })
      .then((result) => {
        if (cancelled) return;
        setStatus(result);
        if (result.needed && !wasDismissed()) setOpen(true);
      })
      .catch(() => {
        // nunca travar o app por causa do aviso de cobrança
      });
    return () => {
      cancelled = true;
    };
  }, [getStatus]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      markDismissed();
      setMode("boleto");
    }
  }, []);

  if (!status?.needed) return null;

  const label = PRICE_LABELS[status.priceId] ?? { plan: "atual", amount: "" };

  return (
    <>
      <div className="ck-r-flat-sm mx-4 mt-4 flex flex-col gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:mx-6 sm:flex-row sm:items-center sm:justify-between md:mx-10 md:mt-6">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Pagamento pendente.</strong> Seu plano {label.plan} está suspenso e seus funis
            não estão recebendo novos leads.
          </span>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="ck-btn shrink-0 font-semibold">
          Regularizar agora
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange} modal={mode === "boleto"}>
        <DialogContent
          allowStripePointerPassThrough={mode === "card"}
          className={`max-h-[92vh] overflow-y-auto ${mode === "card" ? "max-w-3xl" : "max-w-lg"}`}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Regularize sua assinatura
            </DialogTitle>
            <DialogDescription>
              A cobrança do seu plano <strong>{label.plan}</strong>
              {label.amount ? ` (${label.amount})` : ""} não foi concluída e a assinatura foi
              suspensa. Enquanto isso, seus funis não recebem novos leads.
            </DialogDescription>
          </DialogHeader>

          {mode === "boleto" ? (
            <div className="mt-2">
              {generated ? (
                <div className="ck-r-sig border border-primary/30 bg-primary/5 p-5 text-sm">
                  <p className="font-semibold text-foreground">Boleto gerado!</p>
                  <p className="mt-1 text-muted-foreground">
                    Ele abriu em uma nova aba e também vai por e-mail. Assim que o pagamento
                    compensar (até 2 dias úteis), seu plano volta sozinho. Nada mais precisa ser
                    feito aqui.
                  </p>
                  <Button
                    className="ck-btn mt-4 font-semibold"
                    onClick={() => handleOpenChange(false)}
                  >
                    Entendi
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    Gerar boleto de {label.amount || "reativação"}
                  </div>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Confira os dados de cobrança. O boleto abre em uma página segura e o plano
                    reativa automaticamente quando o pagamento compensar. Sem cobrança do período em
                    atraso.
                  </p>
                  <BoletoSubscriptionForm
                    priceId={status.priceId}
                    initialBilling={status.billing}
                    submitLabel={`Gerar boleto${label.amount ? ` de ${label.amount.replace("/mês", "").replace("/ano", "")}` : ""}`}
                    onGenerated={() => setGenerated(true)}
                  />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setMode("card")}
                      className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                      <CreditCard className="h-4 w-4" />
                      Prefiro pagar com cartão
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenChange(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Agora não
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setMode("boleto")}
                className="mb-3 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                ← Voltar ao boleto
              </button>
              <Suspense
                fallback={
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Carregando checkout...
                  </div>
                }
              >
                <StripeEmbeddedCheckout priceId={status.priceId} />
              </Suspense>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
