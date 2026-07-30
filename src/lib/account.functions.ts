import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

type DeleteAccountResult = { ok: true } | { error: string };

// billing_profiles was created outside Lovable's migration flow, so the
// generated Database types don't know it yet.
function billingProfilesTable() {
  return (supabaseAdmin as unknown as import("@supabase/supabase-js").SupabaseClient).from("billing_profiles");
}

export type MyBillingProfile = {
  legal_name: string | null;
  tax_id: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  email: string | null;
  notes: string | null;
};

const BILLING_FIELD_MAX = 200;
function cleanBillingField(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, BILLING_FIELD_MAX);
  return t.length ? t : null;
}

async function resolveStripeCustomerId(userId: string): Promise<string | null> {
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.stripe_customer_id) return prof.stripe_customer_id;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return sub?.stripe_customer_id ?? null;
}

export const getMyBillingProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ billing: MyBillingProfile | null }> => {
    const { data, error } = await billingProfilesTable()
      .select("legal_name, tax_id, address_line, city, state, postal_code, email, notes")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { billing: data ?? null };
  });

export const saveMyBillingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<MyBillingProfile>) => data)
  .handler(async ({ data, context }): Promise<{ ok: true; message: string } | { error: string }> => {
    const userId = context.userId;
    const stripeCustomerId = await resolveStripeCustomerId(userId);

    // A row may already exist keyed only by the Stripe customer (created by
    // the admin), so match on either key before deciding insert vs update.
    const orFilter = stripeCustomerId
      ? `user_id.eq.${userId},stripe_customer_id.eq.${stripeCustomerId}`
      : `user_id.eq.${userId}`;
    const { data: existing, error: findError } = await billingProfilesTable()
      .select("id")
      .or(orFilter)
      .limit(1)
      .maybeSingle();
    if (findError) return { error: findError.message };

    const payload: Record<string, unknown> = {
      user_id: userId,
      legal_name: cleanBillingField(data.legal_name),
      tax_id: cleanBillingField(data.tax_id),
      address_line: cleanBillingField(data.address_line),
      city: cleanBillingField(data.city),
      state: cleanBillingField(data.state),
      postal_code: cleanBillingField(data.postal_code),
      email: cleanBillingField(data.email),
      notes: cleanBillingField(data.notes),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };
    if (stripeCustomerId) payload.stripe_customer_id = stripeCustomerId;

    const { error } = existing
      ? await billingProfilesTable().update(payload).eq("id", existing.id)
      : await billingProfilesTable().insert(payload);
    if (error) return { error: error.message };
    return { ok: true, message: "Dados de faturamento salvos." };
  });

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeleteAccountResult> => {
    const userId = context.userId;

    try {
      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id, environment, status")
        .eq("user_id", userId);

      if (subError) return { error: subError.message };

      for (const subscription of subscriptions ?? []) {
        if (!subscription.stripe_subscription_id || !ACTIVE_STRIPE_STATUSES.has(subscription.status)) continue;
        const stripe = createStripeClient(subscription.environment as StripeEnv);
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return { error: error.message };

      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
