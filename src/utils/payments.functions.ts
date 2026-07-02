import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { getRequest } from "@tanstack/react-start/server";

const ALLOWED_RETURN_HOSTS = new Set([
  "clinik.club",
  "www.clinik.club",
  "kindred-ignite-forge.lovable.app",
  "id-preview--f6c0c93d-41eb-463c-89ff-ab117eaa47a7.lovable.app",
  "localhost",
]);

function sanitizeReturnUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!ALLOWED_RETURN_HOSTS.has(u.hostname)) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

async function getVerifiedUserFromRequest(): Promise<{ id: string; email: string | null } | undefined> {
  try {
    const request = getRequest();
    const auth = request?.headers?.get("authorization") ?? undefined;
    if (!auth?.startsWith("Bearer ")) return undefined;
    const token = auth.slice("Bearer ".length).trim();
    if (!token) return undefined;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return undefined;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    return undefined;
  }
}

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type BoletoSubscriptionResult = { invoiceUrl: string | null; subscriptionId: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

type BoletoBillingDetails = {
  name: string;
  taxId: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, weight, index) => acc + Number(base[index]) * weight, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const first = calc(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

function formatCpfCnpjForStripe(digits: string): string {
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function normalizeBoletoBilling(input: BoletoBillingDetails):
  | { billing: BoletoBillingDetails; taxIdDigits: string }
  | { error: string } {
  const billing = {
    name: input.name.trim().replace(/\s+/g, " "),
    taxId: input.taxId.trim(),
    addressLine1: input.addressLine1.trim().replace(/\s+/g, " "),
    city: input.city.trim().replace(/\s+/g, " "),
    state: input.state.trim().toUpperCase(),
    postalCode: input.postalCode.trim(),
  };
  const taxIdDigits = onlyDigits(billing.taxId);
  const postalDigits = onlyDigits(billing.postalCode);

  if (billing.name.length < 3) return { error: "Informe o nome completo para gerar o boleto." };
  if (taxIdDigits.length === 11 && !isValidCpf(taxIdDigits)) return { error: "CPF inválido. Confira os números digitados." };
  if (taxIdDigits.length === 14 && !isValidCnpj(taxIdDigits)) return { error: "CNPJ inválido. Confira os números digitados." };
  if (taxIdDigits.length !== 11 && taxIdDigits.length !== 14) return { error: "Informe um CPF ou CNPJ válido." };
  if (billing.addressLine1.length < 5) return { error: "Informe o endereço completo para gerar o boleto." };
  if (billing.city.length < 2) return { error: "Informe a cidade para gerar o boleto." };
  if (!/^[A-Z]{2}$/.test(billing.state)) return { error: "Informe a UF com 2 letras, como SP ou RJ." };
  if (postalDigits.length !== 8) return { error: "Informe um CEP válido com 8 números." };

  return {
    billing: {
      ...billing,
      taxId: formatCpfCnpjForStripe(taxIdDigits),
      postalCode: `${postalDigits.slice(0, 5)}-${postalDigits.slice(5)}`,
    },
    taxIdDigits,
  };
}

function getStripeBoletoTaxId(environment: StripeEnv, taxIdDigits: string): string {
  // In sandbox, Stripe's documented Boleto tax ID is a test value. Live mode uses the customer's real CPF/CNPJ.
  if (environment === "sandbox") return "000.000.000-00";
  return formatCpfCnpjForStripe(taxIdDigits);
}

async function getBoletoVoucherUrl(stripe: ReturnType<typeof createStripeClient>, latestInvoice: any): Promise<string | null> {
  let invoice = latestInvoice;
  if (typeof invoice === "string") invoice = await stripe.invoices.retrieve(invoice, { expand: ["payment_intent"] } as any);
  const paymentIntentRef = invoice?.payment_intent;
  let paymentIntent = typeof paymentIntentRef === "object" ? paymentIntentRef : null;
  if (typeof paymentIntentRef === "string") {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentRef);
  }
  return paymentIntent?.next_action?.boleto_display_details?.hosted_voucher_url
    ?? invoice?.hosted_invoice_url
    ?? null;
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string | null; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    customerEmail?: string;
    returnUrl: string;
    environment: StripeEnv;
    paymentMethod?: "card" | "boleto";
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      // Never trust client-supplied identity fields. Derive user id/email from the verified bearer token.
      const verifiedUser = await getVerifiedUserFromRequest();
      if (!verifiedUser) {
        return { error: "Faça login ou crie sua conta antes de assinar." };
      }
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];

      const customerId = await resolveOrCreateCustomer(stripe, { email: verifiedUser.email, userId: verifiedUser.id });

      const isRecurring = stripePrice.type === "recurring";

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: sanitizeReturnUrl(data.returnUrl) ?? "https://clinik.club/checkout/return",
        payment_method_types: ["card"],
        allow_promotion_codes: true,
        wallet_options: { link: { display: "never" } },
        ...(customerId && { customer: customerId }),
        metadata: {
          ...(verifiedUser && { userId: verifiedUser.id }),
          ...(verifiedUser?.email && { customerEmail: verifiedUser.email }),
          paymentMethod: "card",
        },
        subscription_data: {
          metadata: {
            ...(verifiedUser && { userId: verifiedUser.id }),
            ...(verifiedUser?.email && { customerEmail: verifiedUser.email }),
            paymentMethod: "card",
          },
        },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const startBoletoSubscription = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
    billing: BoletoBillingDetails;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data }): Promise<BoletoSubscriptionResult> => {
    try {
      const verifiedUser = await getVerifiedUserFromRequest();
      if (!verifiedUser) {
        return { error: "Faça login ou crie sua conta antes de assinar." };
      }

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      if (stripePrice.type !== "recurring") {
        return { error: "Boleto mensal só está disponível para planos recorrentes." };
      }
      if (stripePrice.currency?.toLowerCase() !== "brl") {
        return { error: "Boleto só está disponível para cobranças em BRL." };
      }

      const normalized = normalizeBoletoBilling(data.billing);
      if ("error" in normalized) return { error: normalized.error };

      const customerId = await resolveOrCreateCustomer(stripe, { email: verifiedUser.email, userId: verifiedUser.id });
      const address = {
        line1: normalized.billing.addressLine1,
        city: normalized.billing.city,
        state: normalized.billing.state,
        postal_code: normalized.billing.postalCode,
        country: "BR",
      };
      const paymentMethod = await stripe.paymentMethods.create({
        type: "boleto",
        boleto: { tax_id: getStripeBoletoTaxId(data.environment, normalized.taxIdDigits) },
        billing_details: {
          name: normalized.billing.name,
          ...(verifiedUser.email && { email: verifiedUser.email }),
          address,
        },
      } as any);

      await stripe.paymentMethods.attach(paymentMethod.id, { customer: customerId });
      await stripe.customers.update(customerId, {
        name: normalized.billing.name,
        ...(verifiedUser.email && { email: verifiedUser.email }),
        address,
        invoice_settings: { default_payment_method: paymentMethod.id },
        metadata: { userId: verifiedUser.id },
      } as any);

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePrice.id }],
        collection_method: "charge_automatically",
        payment_behavior: "default_incomplete",
        default_payment_method: paymentMethod.id,
        off_session: true,
        payment_settings: {
          payment_method_types: ["boleto"],
          save_default_payment_method: "on_subscription",
          payment_method_options: { boleto: { expires_after_days: 3 } },
        },
        metadata: {
          userId: verifiedUser.id,
          ...(verifiedUser.email && { customerEmail: verifiedUser.email }),
          paymentMethod: "boleto",
        },
        expand: ["latest_invoice.payment_intent", "items.data.price"],
      } as any);

      const item = subscription.items?.data?.[0];
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product?.id;
      let latestInvoice: any = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
      if (typeof subscription.latest_invoice === "string") {
        latestInvoice = await stripe.invoices.retrieve(subscription.latest_invoice, { expand: ["payment_intent"] } as any);
      }
      const boletoUrl = await getBoletoVoucherUrl(stripe, latestInvoice);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: verifiedUser.id,
          customer_email: verifiedUser.email,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          product_id: productId ?? "boleto",
          price_id: stripePrice.lookup_key ?? data.priceId,
          status: latestInvoice?.status === "paid" ? subscription.status : "incomplete",
          current_period_start: latestInvoice?.status === "paid" && item?.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
          current_period_end: latestInvoice?.status === "paid" && item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
          environment: data.environment,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_subscription_id" },
      );

      return {
        subscriptionId: subscription.id,
        invoiceUrl: boletoUrl,
      };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalSessionResult> => {
    const { supabase, userId } = context;

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subError || !sub?.stripe_customer_id) {
      return { error: "Nenhuma assinatura encontrada." };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const safeReturn = sanitizeReturnUrl(data.returnUrl);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(safeReturn && { return_url: safeReturn }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

type CheckoutSessionInfo =
  | { email: string | null; status: string | null }
  | { error: string };

export const getCheckoutSessionInfo = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(data.sessionId)) {
      throw new Error("Invalid sessionId");
    }
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionInfo> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const email =
        session.customer_details?.email ??
        (typeof session.customer_email === "string" ? session.customer_email : null);
      return { email, status: session.status ?? null };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
