import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createStripeClient, type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

function requireOk(error: any, label: string) {
  if (error) {
    console.error(`[webhook] ${label} failed:`, error);
    throw new Error(`${label}: ${error.message ?? "db error"}`);
  }
}

async function getCustomerEmail(subscription: any, env: StripeEnv): Promise<string | null> {
  const metadataEmail = subscription.metadata?.customerEmail;
  if (typeof metadataEmail === "string" && metadataEmail.includes("@")) return metadataEmail;

  const customer = subscription.customer;
  if (customer && typeof customer === "object") {
    return typeof customer.email === "string" ? customer.email : null;
  }
  if (typeof customer !== "string") return null;

  try {
    const stripe = createStripeClient(env);
    const found = await stripe.customers.retrieve(customer);
    if (!found.deleted && typeof found.email === "string") return found.email;
  } catch (error) {
    console.warn("[webhook] customer email lookup failed", error);
  }
  return null;
}

async function isBoletoInitialInvoicePaid(subscription: any, env: StripeEnv): Promise<boolean> {
  if (subscription.metadata?.paymentMethod !== "boleto") return true;
  const invoiceRef = subscription.latest_invoice;
  if (!invoiceRef) return false;
  if (typeof invoiceRef === "object") return invoiceRef.status === "paid" || (invoiceRef as any).paid === true;
  try {
    const stripe = createStripeClient(env);
    const invoice = await stripe.invoices.retrieve(invoiceRef);
    return invoice.status === "paid" || (invoice as any).paid === true;
  } catch (error) {
    console.warn("[webhook] boleto invoice lookup failed", error);
    return false;
  }
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId: string | null = subscription.metadata?.userId ?? null;
  const customerEmail = await getCustomerEmail(subscription, env);
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const invoicePaid = await isBoletoInitialInvoicePaid(subscription, env);

  const supabase = getSupabase();
  const linkedUserId: string | null = userId;

  const { error: upsertErr } = await supabase.from("subscriptions").upsert(
    {
      user_id: linkedUserId,
      customer_email: customerEmail,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: invoicePaid ? subscription.status : "incomplete",
      current_period_start: invoicePaid && periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: invoicePaid && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  requireOk(upsertErr, "subscriptions.upsert");

  const planMap: Record<string, string> = {
    starter_monthly: "starter",
    starter_yearly: "starter",
    pro_monthly: "pro",
    pro_yearly: "pro",
    agency_monthly: "agency",
    agency_yearly: "agency",
  };
  const plan = planMap[priceId] ?? "free";
  if (linkedUserId) {
    const { error } = await supabase.from("profiles").update({
      ...(invoicePaid && { plan }),
      subscription_status: invoicePaid ? subscription.status : "incomplete",
      stripe_customer_id: subscription.customer,
    }).eq("id", linkedUserId);
    requireOk(error, "profiles.update(created)");
  } else if (customerEmail) {
    console.warn("[webhook] subscription created without verified user metadata for email", customerEmail);
  }
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;
  const invoicePaid = await isBoletoInitialInvoicePaid(subscription, env);

  const supabase = getSupabase();
  const { error: updErr } = await supabase.from("subscriptions").update({
    status: invoicePaid ? subscription.status : "incomplete",
    product_id: productId,
    price_id: priceId,
    current_period_start: invoicePaid && periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: invoicePaid && periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id).eq("environment", env);
  requireOk(updErr, "subscriptions.update");

  const userId = subscription.metadata?.userId;
  if (userId) {
    const { error } = await supabase.from("profiles").update({
      subscription_status: invoicePaid ? subscription.status : "incomplete",
    }).eq("id", userId);
    requireOk(error, "profiles.update(updated)");
  }
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subscriptionId) return;

  const stripe = createStripeClient(env);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = typeof item?.price?.product === "string"
    ? item.price.product
    : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? (subscription as any).current_period_start;
  const periodEnd = item?.current_period_end ?? (subscription as any).current_period_end;
  const userId: string | null = subscription.metadata?.userId ?? null;
  const customerEmail = await getCustomerEmail(subscription, env);

  const supabase = getSupabase();
  const { error: upsertErr } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      customer_email: customerEmail,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  requireOk(upsertErr, "subscriptions.upsert(invoice.paid)");

  const planMap: Record<string, string> = {
    starter_monthly: "starter",
    starter_yearly: "starter",
    pro_monthly: "pro",
    pro_yearly: "pro",
    agency_monthly: "agency",
    agency_yearly: "agency",
  };
  const plan = planMap[priceId] ?? "free";
  if (userId) {
    const { error } = await supabase.from("profiles").update({
      plan,
      subscription_status: subscription.status,
      stripe_customer_id: subscription.customer,
    }).eq("id", userId);
    requireOk(error, "profiles.update(invoice.paid)");
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  const { error: delErr } = await supabase.from("subscriptions").update({
    status: "canceled",
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id).eq("environment", env);
  requireOk(delErr, "subscriptions.update(canceled)");

  const userId = subscription.metadata?.userId;
  if (userId) {
    const { error } = await supabase.from("profiles").update({
      plan: "free",
      subscription_status: "canceled",
    }).eq("id", userId);
    requireOk(error, "profiles.update(deleted)");
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  const supabase = getSupabase();
  const eventId = (event as any).id as string | undefined;
  if (eventId) {
    const { error: idemErr } = await supabase
      .from("processed_webhook_events")
      .insert({ event_id: eventId, source: "stripe" });
    if (idemErr) {
      // Unique violation → already processed, exit early.
      if ((idemErr as any).code === "23505") {
        console.log("[webhook] duplicate event, skipping", eventId);
        return;
      }
      console.error("[webhook] idempotency insert error", idemErr);
    }
  }
  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
