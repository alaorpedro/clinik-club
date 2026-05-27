import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

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

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId: string | null = subscription.metadata?.userId ?? null;
  const customerEmail: string | null = subscription.metadata?.customerEmail ?? null;
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.lookup_key
    || item?.price?.metadata?.lovable_external_id
    || item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  const supabase = getSupabase();

  // For anonymous checkouts, try to link by email to an existing auth user.
  let linkedUserId: string | null = userId;
  if (!linkedUserId && customerEmail) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("id", "%") // no-op filter; we use auth via admin below
      .limit(0);
    void existing;
    // Look up auth user by email via admin API
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = list?.users?.find((u: any) => (u.email ?? "").toLowerCase() === customerEmail.toLowerCase());
    if (match) linkedUserId = match.id;
  }

  await supabase.from("subscriptions").upsert(
    {
      user_id: linkedUserId,
      customer_email: customerEmail,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );

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
    await supabase.from("profiles").update({
      plan,
      subscription_status: subscription.status,
      stripe_customer_id: subscription.customer,
    }).eq("id", linkedUserId);
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

  const supabase = getSupabase();
  await supabase.from("subscriptions").update({
    status: subscription.status,
    product_id: productId,
    price_id: priceId,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id).eq("environment", env);

  const userId = subscription.metadata?.userId;
  if (userId) {
    await supabase.from("profiles").update({
      subscription_status: subscription.status,
    }).eq("id", userId);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  await supabase.from("subscriptions").update({
    status: "canceled",
    updated_at: new Date().toISOString(),
  }).eq("stripe_subscription_id", subscription.id).eq("environment", env);

  const userId = subscription.metadata?.userId;
  if (userId) {
    await supabase.from("profiles").update({
      plan: "free",
      subscription_status: "canceled",
    }).eq("id", userId);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
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