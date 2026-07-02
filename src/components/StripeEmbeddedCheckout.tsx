import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useEffect, useState, useCallback } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession, startBoletoSubscription } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  customerEmail?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, customerEmail, returnUrl }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "boleto">("card");
  const [boletoLoading, setBoletoLoading] = useState(false);
  const [boletoError, setBoletoError] = useState<string | null>(null);
  const [boletoInvoiceUrl, setBoletoInvoiceUrl] = useState<string | null>(null);

  useEffect(() => {
    document.body.setAttribute("data-stripe-checkout-open", "true");

    return () => {
      document.body.removeAttribute("data-stripe-checkout-open");
    };
  }, []);

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const result = await createCheckoutSession({
      data: {
        priceId,
        customerEmail,
        returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
        paymentMethod,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  }, [priceId, customerEmail, returnUrl, paymentMethod]);

  const handleStartBoleto = useCallback(async () => {
    setBoletoLoading(true);
    setBoletoError(null);
    try {
      const result = await startBoletoSubscription({
        data: {
          priceId,
          returnUrl: returnUrl || `${window.location.origin}/checkout/return`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      setBoletoInvoiceUrl(result.invoiceUrl);
      if (result.invoiceUrl) window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setBoletoError(error instanceof Error ? error.message : "Não foi possível gerar o boleto.");
    } finally {
      setBoletoLoading(false);
    }
  }, [priceId, returnUrl]);

  return (
    <div id="checkout">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
        {paymentMethod === "card" ? (
          <>
            <span className="text-muted-foreground">
              Problemas com o cartão? Pague com <strong className="text-foreground">boleto</strong>.
            </span>
            <button
              type="button"
              onClick={() => setPaymentMethod("boleto")}
              className="font-semibold text-primary hover:underline whitespace-nowrap"
            >
              Usar boleto →
            </button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">
              Você receberá um <strong className="text-foreground">novo boleto por email todo mês</strong>. Acesso liberado após confirmação.
            </span>
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className="font-semibold text-primary hover:underline whitespace-nowrap"
            >
              Voltar ao cartão
            </button>
          </>
        )}
      </div>
      {paymentMethod === "boleto" ? (
        <div className="rounded-lg border border-border bg-background p-6 text-center">
          <h3 className="text-lg font-semibold text-foreground">Gerar boleto mensal</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            O boleto abre em uma página segura e também será enviado por email. O plano só ativa depois da compensação do pagamento.
          </p>
          <button
            type="button"
            onClick={handleStartBoleto}
            disabled={boletoLoading}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {boletoLoading ? "Gerando boleto…" : "Gerar boleto"}
          </button>
          {boletoInvoiceUrl && (
            <p className="mt-4 text-sm text-muted-foreground">
              Boleto gerado. <a className="font-semibold text-primary hover:underline" href={boletoInvoiceUrl} target="_blank" rel="noreferrer">Abrir novamente</a>
            </p>
          )}
          {boletoError && <p className="mt-4 text-sm font-medium text-destructive">{boletoError}</p>}
        </div>
      ) : (
        <EmbeddedCheckoutProvider
          stripe={getStripe()}
          options={{ fetchClientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </div>
  );
}