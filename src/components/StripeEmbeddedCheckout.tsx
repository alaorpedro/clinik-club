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
  const [cepLoading, setCepLoading] = useState(false);
  const [boletoBilling, setBoletoBilling] = useState({
    name: "",
    taxId: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
  });

  useEffect(() => {
    document.body.setAttribute("data-stripe-checkout-open", "true");

    return () => {
      document.body.removeAttribute("data-stripe-checkout-open");
    };
  }, []);

  // Pré-preenche com dados salvos localmente do último boleto
  useEffect(() => {
    try {
      const saved = localStorage.getItem("clinik.boleto.billing");
      if (saved) {
        const parsed = JSON.parse(saved);
        setBoletoBilling((current) => ({ ...current, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Busca endereço via ViaCEP quando o CEP tiver 8 dígitos
  useEffect(() => {
    const digits = boletoBilling.postalCode.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data?.erro) return;
        setBoletoBilling((current) => ({
          ...current,
          addressLine1: current.addressLine1 || [data.logradouro, data.bairro].filter(Boolean).join(", "),
          city: current.city || data.localidade || "",
          state: current.state || (data.uf || "").toUpperCase(),
        }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCepLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boletoBilling.postalCode]);

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
          billing: boletoBilling,
        },
      });
      if ("error" in result) throw new Error(result.error);
      if (!result.invoiceUrl) throw new Error("O Stripe não retornou o link do boleto. Tente novamente em instantes.");
      try {
        localStorage.setItem("clinik.boleto.billing", JSON.stringify(boletoBilling));
      } catch {
        /* ignore */
      }
      setBoletoInvoiceUrl(result.invoiceUrl);
      window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setBoletoError(error instanceof Error ? error.message : "Não foi possível gerar o boleto.");
    } finally {
      setBoletoLoading(false);
    }
  }, [priceId, returnUrl, boletoBilling]);

  const updateBoletoBilling = useCallback((field: keyof typeof boletoBilling, value: string) => {
    setBoletoBilling((current) => ({ ...current, [field]: value }));
  }, []);

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
        <div className="rounded-lg border border-border bg-background p-6">
          <h3 className="text-lg font-semibold text-foreground">Gerar boleto mensal</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            O boleto abre em uma página segura e também será enviado por email. O plano só ativa depois da compensação do pagamento.
          </p>
          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm font-medium text-foreground">
              Nome completo
              <input
                value={boletoBilling.name}
                onChange={(event) => updateBoletoBilling("name", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                autoComplete="name"
                required
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              CPF ou CNPJ
              <input
                value={boletoBilling.taxId}
                onChange={(event) => updateBoletoBilling("taxId", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                inputMode="numeric"
                placeholder="123.456.789-09"
                required
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              CEP
              <input
                value={boletoBilling.postalCode}
                onChange={(event) => updateBoletoBilling("postalCode", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                inputMode="numeric"
                autoComplete="postal-code"
                required
              />
              {cepLoading && <span className="mt-1 block text-xs text-muted-foreground">Buscando endereço…</span>}
            </label>
            <label className="sm:col-span-2 text-sm font-medium text-foreground">
              Endereço
              <input
                value={boletoBilling.addressLine1}
                onChange={(event) => updateBoletoBilling("addressLine1", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                autoComplete="street-address"
                placeholder="Rua, número e complemento"
                required
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              Cidade
              <input
                value={boletoBilling.city}
                onChange={(event) => updateBoletoBilling("city", event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-ring focus:ring-2"
                autoComplete="address-level2"
                required
              />
            </label>
            <label className="text-sm font-medium text-foreground">
              UF
              <input
                value={boletoBilling.state}
                onChange={(event) => updateBoletoBilling("state", event.target.value.toUpperCase().slice(0, 2))}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm uppercase outline-none ring-ring focus:ring-2"
                autoComplete="address-level1"
                maxLength={2}
                placeholder="SP"
                required
              />
            </label>
          </div>
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