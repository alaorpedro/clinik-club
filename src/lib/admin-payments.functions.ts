import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

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

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type PaymentRow = {
  subscription_id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  clinic_name: string | null;
  status: string;
  price_id: string | null;
  environment: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  created_at: string | null;
  latest_invoice: {
    id: string;
    status: string | null;
    amount_due: number;
    amount_paid: number;
    currency: string;
    created: string | null;
    hosted_invoice_url: string | null;
    pdf_url: string | null;
    attempt_count: number;
    next_payment_attempt: string | null;
  } | null;
};

const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
const THREE_DECIMAL = new Set(["bhd","jod","kwd","omr","tnd"]);
function toMajor(amount: number | null | undefined, currency: string): number {
  const v = amount ?? 0;
  const c = (currency ?? "").toLowerCase();
  if (ZERO_DECIMAL.has(c)) return v;
  if (THREE_DECIMAL.has(c)) return v / 1000;
  return v / 100;
}
function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

const ADMIN_PAYMENTS_LIMIT = 200;
const ISSUE_STATUSES = new Set(["past_due", "unpaid", "incomplete", "incomplete_expired"]);

export const listAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ payments: PaymentRow[] }> => {
    await ensureAdmin(context.userId);

    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, status, price_id, environment, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, customer_email, created_at")
      .order("created_at", { ascending: false })
      .limit(ADMIN_PAYMENTS_LIMIT);
    if (error) throw new Error(error.message);
    if (!subs?.length) return { payments: [] };

    // user profile lookup
    const userIds = Array.from(new Set(subs.map((s) => s.user_id).filter(Boolean))) as string[];
    const profileById = new Map<string, { name: string | null; clinic_name: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, name, clinic_name")
        .in("id", userIds);
      for (const p of profs ?? []) profileById.set(p.id, { name: p.name, clinic_name: p.clinic_name });
    }

    // email lookup ONLY for the user ids on this page (parallel, bounded).
    const emailById = new Map<string, string | null>();
    const CHUNK = 20;
    for (let i = 0; i < userIds.length; i += CHUNK) {
      const slice = userIds.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(async (id) => {
          try {
            const { data } = await supabaseAdmin.auth.admin.getUserById(id);
            emailById.set(id, data?.user?.email ?? null);
          } catch {
            // skip missing users
          }
        }),
      );
    }

    // group subs by environment so we hit each Stripe client only when needed
    const subsByEnv = new Map<StripeEnv, typeof subs>();
    for (const s of subs) {
      const env = (s.environment === "live" ? "live" : "sandbox") as StripeEnv;
      const arr = subsByEnv.get(env) ?? [];
      arr.push(s);
      subsByEnv.set(env, arr);
    }

    const payments: PaymentRow[] = [];
    for (const [env, list] of subsByEnv.entries()) {
      let stripe: ReturnType<typeof createStripeClient> | null = null;
      try {
        stripe = createStripeClient(env);
      } catch {
        stripe = null;
      }
      // Only fetch invoices for subs that need them (issues + actions surface them).
      // Skips ~80% of Stripe calls on healthy accounts and avoids rate-limit hits.
      const needsInvoice = list.filter((s) => ISSUE_STATUSES.has(s.status));
      const invoiceBySubId = new Map<string, PaymentRow["latest_invoice"]>();
      if (stripe) {
        const CHUNK_STRIPE = 5;
        for (let i = 0; i < needsInvoice.length; i += CHUNK_STRIPE) {
          const slice = needsInvoice.slice(i, i + CHUNK_STRIPE);
          await Promise.all(
            slice.map(async (s) => {
              try {
                const invoices = await stripe!.invoices.list({
                  subscription: s.stripe_subscription_id,
                  limit: 1,
                });
                const inv = invoices.data[0];
                if (inv) {
                  invoiceBySubId.set(s.stripe_subscription_id, {
                    id: inv.id ?? "",
                    status: inv.status ?? null,
                    amount_due: toMajor(inv.amount_due, inv.currency),
                    amount_paid: toMajor(inv.amount_paid, inv.currency),
                    currency: inv.currency,
                    created: isoFromUnix(inv.created),
                    hosted_invoice_url: inv.hosted_invoice_url ?? null,
                    pdf_url: inv.invoice_pdf ?? null,
                    attempt_count: inv.attempt_count ?? 0,
                    next_payment_attempt: isoFromUnix(inv.next_payment_attempt),
                  });
                }
              } catch (e) {
                console.error("Failed to fetch invoice for", s.stripe_subscription_id, e);
              }
            }),
          );
        }
      }
      for (const s of list) {
        const latest = invoiceBySubId.get(s.stripe_subscription_id) ?? null;
        const prof = s.user_id ? profileById.get(s.user_id) : undefined;
        payments.push({
          subscription_id: s.id,
          user_id: s.user_id,
          email: (s.user_id ? emailById.get(s.user_id) : null) ?? s.customer_email ?? null,
          name: prof?.name ?? null,
          clinic_name: prof?.clinic_name ?? null,
          status: s.status,
          price_id: s.price_id ?? null,
          environment: s.environment,
          stripe_customer_id: s.stripe_customer_id,
          stripe_subscription_id: s.stripe_subscription_id,
          current_period_start: s.current_period_start ?? null,
          current_period_end: s.current_period_end ?? null,
          cancel_at_period_end: s.cancel_at_period_end ?? null,
          created_at: s.created_at ?? null,
          latest_invoice: latest,
        });
      }
    }

    return { payments };
  });

type ActionResult = { ok: true; message: string } | { error: string };

export const resendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; environment: StripeEnv }) => {
    if (!/^in_[a-zA-Z0-9]+$/.test(data.invoiceId)) throw new Error("Invalid invoiceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<ActionResult> => {
    await ensureAdmin(context.userId);
    try {
      const stripe = createStripeClient(data.environment);
      await stripe.invoices.sendInvoice(data.invoiceId);
      return { ok: true, message: "Email da fatura reenviado." };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const retryInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invoiceId: string; environment: StripeEnv }) => {
    if (!/^in_[a-zA-Z0-9]+$/.test(data.invoiceId)) throw new Error("Invalid invoiceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<ActionResult> => {
    await ensureAdmin(context.userId);
    try {
      const stripe = createStripeClient(data.environment);
      const inv = await stripe.invoices.pay(data.invoiceId);
      return { ok: true, message: `Cobrança tentada (status: ${inv.status}).` };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const openCustomerPortalAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { customerId: string; environment: StripeEnv; returnUrl?: string }) => {
    if (!/^cus_[a-zA-Z0-9]+$/.test(data.customerId)) throw new Error("Invalid customerId");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    await ensureAdmin(context.userId);
    try {
      const stripe = createStripeClient(data.environment);
      const safeReturn = sanitizeReturnUrl(data.returnUrl);
      const portal = await stripe.billingPortal.sessions.create({
        customer: data.customerId,
        ...(safeReturn && { return_url: safeReturn }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });