import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCardOwnership(supabase: any, userId: string, cardId: string) {
  const { data: card } = await supabase
    .from("crm_lead_cards")
    .select("id, owner_id")
    .eq("id", cardId)
    .maybeSingle();
  if (!card || card.owner_id !== userId) {
    throw new Error("Acesso negado");
  }
}

const DEFAULT_STAGES = [
  { name: "Novos Leads", color: "blue" },
  { name: "Em Atendimento", color: "amber" },
  { name: "Agendou", color: "violet" },
  { name: "Compareceu", color: "cyan" },
  { name: "Fechou", color: "emerald" },
  { name: "Perdeu", color: "rose" },
];

export const hasCrmAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const env = (process.env.PAYMENTS_ENV ?? "sandbox") as string;
    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, price_id, product_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const isActive = rows.some((s: any) => {
      const matchesCrm = s.price_id === "crm_addon_monthly" || s.product_id === "crm_addon";
      if (!matchesCrm) return false;
      const endOk = !s.current_period_end || new Date(s.current_period_end) > new Date();
      return (["active", "trialing"].includes(s.status) && endOk) || (s.status === "canceled" && endOk);
    });
    return { hasAccess: isActive, env };
  });

export const ensureDefaultPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("owner_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (existing) return { pipelineId: existing.id as string };

    const { data: pipeline, error } = await supabase
      .from("crm_pipelines")
      .insert({ owner_id: userId, name: "Pipeline principal", is_default: true })
      .select("id")
      .single();
    if (error || !pipeline) {
      // Race or stale read: pipeline already exists, fetch and return it
      const { data: again } = await supabase
        .from("crm_pipelines")
        .select("id")
        .eq("owner_id", userId)
        .eq("is_default", true)
        .maybeSingle();
      if (again) return { pipelineId: again.id as string };
      throw new Error(error?.message ?? "Falha ao criar pipeline");
    }

    const stagesPayload = DEFAULT_STAGES.map((s, i) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      color: s.color,
      order: i,
    }));
    const { error: stagesError } = await supabase.from("crm_stages").insert(stagesPayload);
    if (stagesError) throw new Error(stagesError.message);
    return { pipelineId: pipeline.id as string };
  });

export const getBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pipelineId?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let pipelineId = data.pipelineId;
    if (!pipelineId) {
      const { data: p } = await supabase
        .from("crm_pipelines")
        .select("id")
        .eq("owner_id", userId)
        .eq("is_default", true)
        .maybeSingle();
      pipelineId = p?.id;
    }
    if (!pipelineId) return { pipelineId: null, stages: [], cards: [] };

    const [{ data: stages }, { data: cards }] = await Promise.all([
      supabase
        .from("crm_stages")
        .select("id, name, color, order")
        .eq("pipeline_id", pipelineId)
        .order("order", { ascending: true }),
      supabase
        .from("crm_lead_cards")
        .select("id, stage_id, position, status, assignee_id, moved_at, lead_id, leads!inner(id, name, email, phone, created_at)")
        .eq("pipeline_id", pipelineId)
        .eq("status", "active")
        .order("position", { ascending: true }),
    ]);

    return {
      pipelineId,
      stages: (stages ?? []).map((s: any) => ({ id: s.id, name: s.name, color: s.color, order: s.order })),
      cards: (cards ?? []).map((c: any) => ({
        id: c.id,
        stageId: c.stage_id,
        position: c.position,
        assigneeId: c.assignee_id,
        movedAt: c.moved_at,
        lead: {
          id: c.leads.id,
          name: c.leads.name,
          email: c.leads.email,
          phone: c.leads.phone,
          createdAt: c.leads.created_at,
        },
      })),
    };
  });

export const moveCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cardId: string; stageId: string; position: number }) => {
    if (!d?.cardId || !d?.stageId) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCardOwnership(supabase, userId, data.cardId);
    const { error } = await supabase
      .from("crm_lead_cards")
      .update({ stage_id: data.stageId, position: data.position, moved_at: new Date().toISOString() })
      .eq("id", data.cardId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: funnels } = await supabase.from("funnels").select("id, name").eq("owner_id", userId);
    const funnelIds = (funnels ?? []).map((f: any) => f.id);
    if (!funnelIds.length) return { leads: [] };
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, email, phone, funnel_id, created_at, utm, answers")
      .in("funnel_id", funnelIds)
      .order("created_at", { ascending: false })
      .limit(500);
    const funnelMap = new Map((funnels ?? []).map((f: any) => [f.id, f.name]));
    return {
      leads: (leads ?? []).map((l: any) => ({
        ...l,
        funnel_name: funnelMap.get(l.funnel_id) ?? "—",
      })),
    };
  });

export const getCardDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cardId: string }) => {
    if (!d?.cardId) throw new Error("cardId obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: card } = await supabase
      .from("crm_lead_cards")
      .select("id, stage_id, position, status, assignee_id, lead_id, leads!inner(id, name, email, phone, created_at, answers, utm, funnel_id)")
      .eq("id", data.cardId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!card) throw new Error("Card não encontrado");
    const [{ data: notes }, { data: events }] = await Promise.all([
      supabase.from("crm_notes").select("id, body, author_id, created_at").eq("lead_card_id", data.cardId).order("created_at", { ascending: false }),
      supabase.from("crm_events").select("id, type, payload, created_at").eq("lead_card_id", data.cardId).order("created_at", { ascending: false }),
    ]);
    return { card, notes: notes ?? [], events: events ?? [] };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cardId: string; body: string }) => {
    if (!d?.cardId || !d?.body?.trim()) throw new Error("Dados inválidos");
    if (d.body.length > 5000) throw new Error("Nota muito longa");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCardOwnership(supabase, userId, data.cardId);
    const { error } = await supabase
      .from("crm_notes")
      .insert({ lead_card_id: data.cardId, author_id: userId, body: data.body.trim() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });