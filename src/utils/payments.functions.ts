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

      const customerId = await resolveOrCreateCustomer(stripe, { email: verifiedUser.email, userId: verifiedUser.id });
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePrice.id }],
        collection_method: "send_invoice",
        days_until_due: 3,
        payment_settings: { payment_method_types: ["boleto"] },
        metadata: {
          userId: verifiedUser.id,
          ...(verifiedUser.email && { customerEmail: verifiedUser.email }),
          paymentMethod: "boleto",
        },
        expand: ["latest_invoice"],
      });

      const item = subscription.items?.data?.[0];
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product?.id;
      let latestInvoice: any = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
      if (typeof subscription.latest_invoice === "string") {
        latestInvoice = await stripe.invoices.retrieve(subscription.latest_invoice);
      }
      if (latestInvoice?.id && latestInvoice.status === "draft") {
        latestInvoice = await stripe.invoices.finalizeInvoice(latestInvoice.id);
      }
      if (latestInvoice?.id && !latestInvoice.hosted_invoice_url && latestInvoice.status !== "paid") {
        latestInvoice = await stripe.invoices.retrieve(latestInvoice.id);
      }
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
        invoiceUrl: latestInvoice?.hosted_invoice_url ?? null,
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
