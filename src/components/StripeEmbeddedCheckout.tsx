import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useEffect, useState, useCallback } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  customerEmail?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, customerEmail, returnUrl }: Props) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "boleto">("card");

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
              Você receberá um <strong className="text-foreground">novo boleto por email todo mês</strong>. Acesso liberado após a confirmação do pagamento (1–2 dias úteis).
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
      <EmbeddedCheckoutProvider
        key={paymentMethod}
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}