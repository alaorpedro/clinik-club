import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useEffect, useState, useCallback } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";
import { BoletoSubscriptionForm } from "@/components/BoletoSubscriptionForm";

// Liga/desliga a opção de boleto em todo checkout do site (funis, CRM, alerta
// WhatsApp) com uma troca só — volta e meia sai/entra por causa de campanha.
// O popup "Regularize sua assinatura" NÃO passa por aqui: lá o boleto é sempre
// oferecido (BoletoSubscriptionForm direto).
const BOLETO_ENABLED = false;

interface Props {
  priceId: string;
  customerEmail?: string;
  returnUrl?: string;
  funnelId?: string;
  promoCode?: string;
}

export function StripeEmbeddedCheckout({
  priceId,
  customerEmail,
  returnUrl,
  funnelId,
  promoCode,
}: Props) {
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
        returnUrl:
          returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
        paymentMethod,
        funnelId,
        promoCode,
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  }, [priceId, customerEmail, returnUrl, paymentMethod, funnelId, promoCode]);

  return (
    <div id="checkout">
      {BOLETO_ENABLED && (
        <div className="ck-r-sig-sm mb-3 flex items-center justify-between gap-2 border border-border bg-muted/30 px-3 py-2 text-xs">
          {paymentMethod === "card" ? (
            <>
              <span className="text-muted-foreground">
                Problemas com o cartão? Pague com{" "}
                <strong className="text-foreground">boleto</strong>.
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
                Você receberá um{" "}
                <strong className="text-foreground">novo boleto por email todo mês</strong>. Acesso
                liberado após confirmação.
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
      )}
      {BOLETO_ENABLED && paymentMethod === "boleto" ? (
        <div className="ck-r-sig border border-border bg-background p-6">
          <h3 className="text-lg font-semibold text-foreground">Gerar boleto mensal</h3>
          <p className="mt-2 mb-5 max-w-md text-sm text-muted-foreground">
            O boleto abre em uma página segura e também será enviado por email. O plano só ativa
            depois da compensação do pagamento.
          </p>
          <BoletoSubscriptionForm
            priceId={priceId}
            returnUrl={returnUrl}
            funnelId={funnelId}
            promoCode={promoCode}
          />
        </div>
      ) : (
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </div>
  );
}
