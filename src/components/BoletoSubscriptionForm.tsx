import { useCallback, useEffect, useState } from "react";
import { getStripeEnvironment } from "@/lib/stripe";
import { startBoletoSubscription } from "@/utils/payments.functions";

export type BoletoBilling = {
  name: string;
  taxId: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

const EMPTY_BILLING: BoletoBilling = {
  name: "",
  taxId: "",
  addressLine1: "",
  city: "",
  state: "",
  postalCode: "",
};

const STORAGE_KEY = "clinik.boleto.billing";

interface Props {
  priceId: string;
  /** Dados pré-preenchidos (ex.: billing_profiles). Campos vazios caem no último boleto salvo no navegador. */
  initialBilling?: Partial<BoletoBilling>;
  returnUrl?: string;
  funnelId?: string;
  promoCode?: string;
  submitLabel?: string;
  onGenerated?: (invoiceUrl: string) => void;
}

// Formulário de boleto mensal compartilhado pelo checkout (planos, CRM, alerta
// WhatsApp) e pelo popup "Regularize sua assinatura". Gera a assinatura por
// boleto no Stripe e abre o voucher; o plano ativa quando o boleto compensa.
export function BoletoSubscriptionForm({
  priceId,
  initialBilling,
  returnUrl,
  funnelId,
  promoCode,
  submitLabel = "Gerar boleto",
  onGenerated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [billing, setBilling] = useState<BoletoBilling>(() => {
    let saved: Partial<BoletoBilling> = {};
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) saved = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const merged = { ...EMPTY_BILLING, ...saved };
    for (const key of Object.keys(EMPTY_BILLING) as (keyof BoletoBilling)[]) {
      const value = initialBilling?.[key];
      if (value) merged[key] = value;
    }
    return merged;
  });

  // Busca endereço via ViaCEP quando o CEP tiver 8 dígitos
  useEffect(() => {
    const digits = billing.postalCode.replace(/\D/g, "");
    if (digits.length !== 8) return;
    let cancelled = false;
    setCepLoading(true);
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data?.erro) return;
        setBilling((current) => ({
          ...current,
          addressLine1:
            current.addressLine1 || [data.logradouro, data.bairro].filter(Boolean).join(", "),
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
  }, [billing.postalCode]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await startBoletoSubscription({
        data: {
          priceId,
          returnUrl: returnUrl || `${window.location.origin}/checkout/return`,
          environment: getStripeEnvironment(),
          billing,
          funnelId,
          promoCode,
        },
      });
      if ("error" in result) throw new Error(result.error);
      if (!result.invoiceUrl)
        throw new Error("O Stripe não retornou o link do boleto. Tente novamente em instantes.");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(billing));
      } catch {
        /* ignore */
      }
      setInvoiceUrl(result.invoiceUrl);
      window.open(result.invoiceUrl, "_blank", "noopener,noreferrer");
      onGenerated?.(result.invoiceUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o boleto.");
    } finally {
      setLoading(false);
    }
  }, [priceId, returnUrl, billing, funnelId, promoCode, onGenerated]);

  const update = useCallback((field: keyof BoletoBilling, value: string) => {
    setBilling((current) => ({ ...current, [field]: value }));
  }, []);

  return (
    <div>
      <div className="grid gap-3 text-left sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-medium text-foreground">
          Nome completo ou razão social
          <input
            value={billing.name}
            onChange={(event) => update("name", event.target.value)}
            className="ck-input mt-1 h-10 w-full px-3 text-sm"
            autoComplete="name"
            required
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          CPF ou CNPJ
          <input
            value={billing.taxId}
            onChange={(event) => update("taxId", event.target.value)}
            className="ck-input mt-1 h-10 w-full px-3 text-sm"
            inputMode="numeric"
            placeholder="123.456.789-09"
            required
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          CEP
          <input
            value={billing.postalCode}
            onChange={(event) => update("postalCode", event.target.value)}
            className="ck-input mt-1 h-10 w-full px-3 text-sm"
            inputMode="numeric"
            autoComplete="postal-code"
            required
          />
          {cepLoading && (
            <span className="mt-1 block text-xs text-muted-foreground">Buscando endereço…</span>
          )}
        </label>
        <label className="sm:col-span-2 text-sm font-medium text-foreground">
          Endereço
          <input
            value={billing.addressLine1}
            onChange={(event) => update("addressLine1", event.target.value)}
            className="ck-input mt-1 h-10 w-full px-3 text-sm"
            autoComplete="street-address"
            placeholder="Rua, número e complemento"
            required
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          Cidade
          <input
            value={billing.city}
            onChange={(event) => update("city", event.target.value)}
            className="ck-input mt-1 h-10 w-full px-3 text-sm"
            autoComplete="address-level2"
            required
          />
        </label>
        <label className="text-sm font-medium text-foreground">
          UF
          <input
            value={billing.state}
            onChange={(event) => update("state", event.target.value.toUpperCase().slice(0, 2))}
            className="ck-input mt-1 h-10 w-full px-3 text-sm uppercase"
            autoComplete="address-level1"
            maxLength={2}
            placeholder="SP"
            required
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="ck-btn mt-5 inline-flex h-10 items-center justify-center bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Gerando boleto…" : submitLabel}
      </button>
      {invoiceUrl && (
        <p className="mt-4 text-sm text-muted-foreground">
          Boleto gerado. Se a aba não abriu,{" "}
          <a
            className="font-semibold text-primary hover:underline"
            href={invoiceUrl}
            target="_blank"
            rel="noreferrer"
          >
            clique aqui para abrir
          </a>
          .
        </p>
      )}
      {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
