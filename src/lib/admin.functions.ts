import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

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

export type AdminCustomerRow = {
  user_id: string;
  is_admin: boolean;
  email: string | null;
  name: string | null;
  clinic_name: string | null;
  phone: string | null;
  instagram_url: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  plan: string | null;
  funnels_count: number;
  active_funnels_count: number;
  draft_funnels_count: number;
  leads_count: number;
  completed_leads_count: number;
  partial_leads_count: number;
  connected_sheets_count: number;
  last_lead_at: string | null;
  funnels: Array<{
    id: string;
    name: string | null;
    slug: string | null;
    status: string | null;
    created_at: string | null;
    sheets_connected: boolean;
    leads_count: number;
    completed_leads_count: number;
    partial_leads_count: number;
    last_lead_at: string | null;
  }>;
  subscription: {
    id: string;
    status: string;
    price_id: string | null;
    product_id: string | null;
    environment: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    customer_email: string | null;
    created_at: string | null;
  } | null;
};

const ADMIN_CUSTOMERS_LIMIT = 200;

export const listAdminCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ customers: AdminCustomerRow[] }> => {
    await ensureAdmin(context.userId);

    // 1. Most recent N profiles (bounded to avoid loading the whole table).
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, clinic_name, instagram_url, plan, created_at")
      .order("created_at", { ascending: false })
      .limit(ADMIN_CUSTOMERS_LIMIT);
    if (profErr) throw new Error(profErr.message);

    const profileIds = (profiles ?? []).map((p) => p.id);

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("role", "admin");
    if (rolesErr) throw new Error(rolesErr.message);
    const adminUserIds = new Set((roles ?? []).map((role) => role.user_id));

    // 2. Auth metadata for ONLY the profiles we need (parallel, bounded concurrency).
    const authUsers = new Map<
      string,
      { email: string | null; last_sign_in_at: string | null; phone: string | null }
    >();
    const CHUNK = 20;
    for (let i = 0; i < profileIds.length; i += CHUNK) {
      const slice = profileIds.slice(i, i + CHUNK);
      await Promise.all(
        slice.map(async (id) => {
          try {
            const { data, error } = await supabaseAdmin.auth.admin.getUserById(id);
            if (error || !data?.user) return;
            authUsers.set(id, {
              email: data.user.email ?? null,
              last_sign_in_at: data.user.last_sign_in_at ?? null,
              phone: (data.user.phone as string | undefined) ?? null,
            });
          } catch {
            // ignore per-user lookup failures, profile still renders
          }
        }),
      );
    }

    // 3. Subscriptions for the visible profiles only.
    const { data: subs, error: subErr } = await supabaseAdmin
      .from("subscriptions")
      .select("id, user_id, status, price_id, product_id, environment, current_period_start, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, customer_email, created_at")
      .in("user_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });
    if (subErr) throw new Error(subErr.message);
    const subByUser = new Map<string, NonNullable<AdminCustomerRow["subscription"]>>();
    for (const s of subs ?? []) {
      if (!s.user_id) continue;
      if (!subByUser.has(s.user_id)) {
        subByUser.set(s.user_id, {
          id: s.id,
          status: s.status,
          price_id: s.price_id ?? null,
          product_id: s.product_id ?? null,
          environment: s.environment,
          current_period_start: s.current_period_start ?? null,
          current_period_end: s.current_period_end ?? null,
          cancel_at_period_end: s.cancel_at_period_end ?? null,
          stripe_customer_id: s.stripe_customer_id ?? null,
          stripe_subscription_id: s.stripe_subscription_id ?? null,
          customer_email: s.customer_email ?? null,
          created_at: s.created_at ?? null,
        });
      }
    }

    // 4. Funnels (only for visible owners)
    const { data: funnels, error: funErr } = await supabaseAdmin
      .from("funnels")
      .select("id, owner_id, name, slug, status, created_at, sheets_webhook_url")
      .in("owner_id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"]);
    if (funErr) throw new Error(funErr.message);
    const funnelsCount = new Map<string, number>();
    const activeFunnelsCount = new Map<string, number>();
    const draftFunnelsCount = new Map<string, number>();
    const connectedSheetsCount = new Map<string, number>();
    const funnelIdsByOwner = new Map<string, string[]>();
    const funnelById = new Map<string, {
      id: string;
      owner_id: string;
      name: string | null;
      slug: string | null;
      status: string | null;
      created_at: string | null;
      sheets_webhook_url: string | null;
    }>();
    for (const f of funnels ?? []) {
      funnelsCount.set(f.owner_id, (funnelsCount.get(f.owner_id) ?? 0) + 1);
      if (f.status === "published") activeFunnelsCount.set(f.owner_id, (activeFunnelsCount.get(f.owner_id) ?? 0) + 1);
      if (f.status !== "published") draftFunnelsCount.set(f.owner_id, (draftFunnelsCount.get(f.owner_id) ?? 0) + 1);
      if (f.sheets_webhook_url) connectedSheetsCount.set(f.owner_id, (connectedSheetsCount.get(f.owner_id) ?? 0) + 1);
      const arr = funnelIdsByOwner.get(f.owner_id) ?? [];
      arr.push(f.id);
      funnelIdsByOwner.set(f.owner_id, arr);
      funnelById.set(f.id, {
        id: f.id,
        owner_id: f.owner_id,
        name: f.name ?? null,
        slug: f.slug ?? null,
        status: f.status ?? null,
        created_at: f.created_at ?? null,
        sheets_webhook_url: f.sheets_webhook_url ?? null,
      });
    }

    // 5. Leads (only for funnels of visible owners)
    const allFunnelIds = Array.from(new Set(Array.from(funnelIdsByOwner.values()).flat()));
    const leadsByFunnel = new Map<string, number>();
    const completedLeadsByFunnel = new Map<string, number>();
    const partialLeadsByFunnel = new Map<string, number>();
    const lastLeadByFunnel = new Map<string, string>();
    if (allFunnelIds.length) {
      const { data: leads, error: leadErr } = await supabaseAdmin
        .from("leads")
        .select("funnel_id, status, created_at")
        .in("funnel_id", allFunnelIds);
      if (leadErr) throw new Error(leadErr.message);
      for (const l of leads ?? []) {
        leadsByFunnel.set(l.funnel_id, (leadsByFunnel.get(l.funnel_id) ?? 0) + 1);
        if (l.status === "completed") completedLeadsByFunnel.set(l.funnel_id, (completedLeadsByFunnel.get(l.funnel_id) ?? 0) + 1);
        if (l.status === "partial") partialLeadsByFunnel.set(l.funnel_id, (partialLeadsByFunnel.get(l.funnel_id) ?? 0) + 1);
        const createdAt = l.created_at as string | null;
        if (createdAt && (!lastLeadByFunnel.get(l.funnel_id) || createdAt > lastLeadByFunnel.get(l.funnel_id)!)) {
          lastLeadByFunnel.set(l.funnel_id, createdAt);
        }
      }
    }
    const leadsByOwner = new Map<string, number>();
    const completedLeadsByOwner = new Map<string, number>();
    const partialLeadsByOwner = new Map<string, number>();
    const lastLeadByOwner = new Map<string, string>();
    for (const [ownerId, ids] of funnelIdsByOwner.entries()) {
      let total = 0;
      let completed = 0;
      let partial = 0;
      let lastLead: string | null = null;
      for (const fid of ids) {
        total += leadsByFunnel.get(fid) ?? 0;
        completed += completedLeadsByFunnel.get(fid) ?? 0;
        partial += partialLeadsByFunnel.get(fid) ?? 0;
        const funnelLastLead = lastLeadByFunnel.get(fid) ?? null;
        if (funnelLastLead && (!lastLead || funnelLastLead > lastLead)) lastLead = funnelLastLead;
      }
      leadsByOwner.set(ownerId, total);
      completedLeadsByOwner.set(ownerId, completed);
      partialLeadsByOwner.set(ownerId, partial);
      if (lastLead) lastLeadByOwner.set(ownerId, lastLead);
    }

    // 6. Lookup phone from leads when not in auth (best-effort)
    const customers: AdminCustomerRow[] = (profiles ?? []).map((p) => {
      const au = authUsers.get(p.id);
      const ownerFunnelIds = funnelIdsByOwner.get(p.id) ?? [];
      const ownerFunnels = ownerFunnelIds
        .map((id) => funnelById.get(id))
        .filter(Boolean)
        .map((f) => ({
          id: f!.id,
          name: f!.name,
          slug: f!.slug,
          status: f!.status,
          created_at: f!.created_at,
          sheets_connected: !!f!.sheets_webhook_url,
          leads_count: leadsByFunnel.get(f!.id) ?? 0,
          completed_leads_count: completedLeadsByFunnel.get(f!.id) ?? 0,
          partial_leads_count: partialLeadsByFunnel.get(f!.id) ?? 0,
          last_lead_at: lastLeadByFunnel.get(f!.id) ?? null,
        }))
        .sort((a, b) => (b.leads_count - a.leads_count) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
      return {
        user_id: p.id,
        is_admin: adminUserIds.has(p.id),
        email: au?.email ?? null,
        name: p.name,
        clinic_name: p.clinic_name,
        phone: au?.phone ?? null,
        instagram_url: p.instagram_url,
        created_at: p.created_at,
        last_sign_in_at: au?.last_sign_in_at ?? null,
        plan: p.plan,
        funnels_count: funnelsCount.get(p.id) ?? 0,
        active_funnels_count: activeFunnelsCount.get(p.id) ?? 0,
        draft_funnels_count: draftFunnelsCount.get(p.id) ?? 0,
        leads_count: leadsByOwner.get(p.id) ?? 0,
        completed_leads_count: completedLeadsByOwner.get(p.id) ?? 0,
        partial_leads_count: partialLeadsByOwner.get(p.id) ?? 0,
        connected_sheets_count: connectedSheetsCount.get(p.id) ?? 0,
        last_lead_at: lastLeadByOwner.get(p.id) ?? null,
        funnels: ownerFunnels,
        subscription: subByUser.get(p.id) ?? null,
      };
    });

    return { customers };
  });

export const deleteAdminCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => {
    if (!d?.userId || typeof d.userId !== "string") throw new Error("userId obrigatório");
    return { userId: d.userId };
  })
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    await ensureAdmin(context.userId);

    if (data.userId === context.userId) {
      return { error: "Você não pode excluir sua própria conta pelo painel admin." };
    }

    const { data: targetRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) return { error: roleError.message };
    if (targetRole) {
      return { error: "Contas administradoras não podem ser excluídas pelo painel." };
    }

    try {
      const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      if (userError || !targetUser?.user) return { error: "Cliente não encontrado." };

      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from("subscriptions")
        .select("id, stripe_subscription_id, environment, status")
        .eq("user_id", data.userId);
      if (subError) return { error: subError.message };

      for (const subscription of subscriptions ?? []) {
        if (!subscription.stripe_subscription_id || !ACTIVE_STRIPE_STATUSES.has(subscription.status)) continue;
        const stripe = createStripeClient(subscription.environment as StripeEnv);
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      }

      if (subscriptions?.length) {
        const { error: subscriptionUpdateError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            user_id: null,
            status: "canceled",
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", data.userId);
        if (subscriptionUpdateError) return { error: subscriptionUpdateError.message };
      }

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
      if (deleteError) return { error: deleteError.message };

      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });
