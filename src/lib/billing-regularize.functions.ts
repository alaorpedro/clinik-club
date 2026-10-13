import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPaymentsEnv, type PaymentsEnv } from "@/lib/funnels.functions";

// Regra geral de "regularize sua assinatura" (decidida em 13/10/2026):
// toda conta cujo plano (starter/pro/agency) está cancelado, com cobrança
// falhada ou expirado, e que NÃO tem nenhuma outra assinatura de plano
// saudável, vê o popup pedindo pra gerar o boleto. Sem cobrar atraso — a
// nova assinatura começa a contar do pagamento.

const PLAN_PRICE_RE = /^(starter|pro|agency)_(monthly|yearly)$/;
const HEALTHY_STATUSES = new Set(["active", "trialing"]);
const LAPSED_STATUSES = new Set(["canceled", "past_due", "unpaid", "incomplete_expired"]);

export type RegularizationBilling = {
  name: string;
  taxId: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

export type RegularizationStatus =
  | { needed: false }
  | {
      needed: true;
      priceId: string;
      status: string;
      periodEnd: string | null;
      billing: RegularizationBilling;
    };

type SubscriptionRow = {
  price_id: string | null;
  status: string | null;
  current_period_end: string | null;
  environment: string | null;
  created_at: string | null;
  stripe_subscription_id: string | null;
};

const SUB_COLUMNS =
  "price_id, status, current_period_end, environment, created_at, stripe_subscription_id";

export const getRegularizationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { environment?: PaymentsEnv }) => ({
    environment: data?.environment === "sandbox" ? ("sandbox" as const) : ("live" as const),
  }))
  .handler(async ({ data, context }): Promise<RegularizationStatus> => {
    const userId = context.userId;
    // Mesma regra do resto do app: host de produção força "live"; fora dele vale o
    // ambiente pedido pelo cliente (chave pk_test_ no preview = sandbox).
    const env = getPaymentsEnv(data.environment);

    const { data: adminRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminRow) return { needed: false };

    const { data: byUser } = await supabaseAdmin
      .from("subscriptions")
      .select(SUB_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    let byEmail: SubscriptionRow[] = [];
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = userData.user?.email?.trim().toLowerCase();
      if (email) {
        const { data } = await supabaseAdmin
          .from("subscriptions")
          .select(SUB_COLUMNS)
          .ilike("customer_email", email)
          .order("created_at", { ascending: false });
        byEmail = (data ?? []) as SubscriptionRow[];
      }
    } catch {
      // e-mail é só um segundo caminho de match; sem ele seguimos pelo user_id
    }

    const seen = new Set<string>();
    const plans = [...((byUser ?? []) as SubscriptionRow[]), ...byEmail]
      .filter((row) => {
        const key = row.stripe_subscription_id ?? `${row.price_id}-${row.created_at}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return row.environment === env && PLAN_PRICE_RE.test(row.price_id ?? "");
      })
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

    if (plans.length === 0) return { needed: false };
    if (plans.some((row) => HEALTHY_STATUSES.has(row.status ?? ""))) return { needed: false };

    const lapsed = plans.find((row) => LAPSED_STATUSES.has(row.status ?? ""));
    if (!lapsed?.price_id) return { needed: false };

    // billing_profiles foi criada fora do fluxo do Lovable: não existe nos tipos gerados.
    const { data: profile } = await (supabaseAdmin as unknown as SupabaseClient)
      .from("billing_profiles")
      .select("legal_name, tax_id, address_line, city, state, postal_code")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      needed: true,
      priceId: lapsed.price_id,
      status: lapsed.status ?? "canceled",
      periodEnd: lapsed.current_period_end,
      billing: {
        name: profile?.legal_name ?? "",
        taxId: profile?.tax_id ?? "",
        addressLine1: profile?.address_line ?? "",
        city: profile?.city ?? "",
        state: profile?.state ?? "",
        postalCode: profile?.postal_code ?? "",
      },
    };
  });
