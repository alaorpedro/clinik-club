import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useEffect } from "react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  customerEmail?: string;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, customerEmail, returnUrl }: Props) {
  useEffect(() => {
    document.body.setAttribute("data-stripe-checkout-open", "true");

    return () => {
      document.body.removeAttribute("data-stripe-checkout-open");
    };
  }, []);

  const fetchClientSecret = async (): Promise<string> => {
    const result = await createCheckoutSession({
      data: {
        priceId,
        customerEmail,
        returnUrl: returnUrl || `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe did not return a client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}