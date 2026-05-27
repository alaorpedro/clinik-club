import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type PortalSessionResult = { url: string } | { error: string };

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    priceId: string;
    customerEmail?: string;
    userId?: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];

      const customerId = (data.customerEmail || data.userId)
        ? await resolveOrCreateCustomer(stripe, { email: data.customerEmail, userId: data.userId })
        : undefined;

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        ...(customerId && { customer: customerId }),
        metadata: {
          ...(data.userId && { userId: data.userId }),
          ...(data.customerEmail && { customerEmail: data.customerEmail }),
        },
        subscription_data: {
          metadata: {
            ...(data.userId && { userId: data.userId }),
            ...(data.customerEmail && { customerEmail: data.customerEmail }),
          },
        },
      });

      return { clientSecret: session.client_secret ?? "" };
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
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
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