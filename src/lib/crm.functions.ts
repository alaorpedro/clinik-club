import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Slug determinístico do funil técnico usado como âncora de FK para contatos
// importados pelo CRM (leads.funnel_id é NOT NULL). Nunca fica em status
// "published", então getPublicFunnel nunca o retorna — ver f.$slug.tsx.
// funnels.functions.ts importa isto para excluí-lo da contagem de cota do
// plano (getPlanUsage/createFunnelChecked) — sem isso, o funil técnico
// consumiria a vaga de funil real do cliente.
export function crmImportFunnelSlug(userId: string): string {
  return `crm-import-${userId}`;
}

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// Traduz as respostas cruas do funil (chave "step_<id>") pro texto da pergunta,
// mesma convenção que buildSheetsLeadPayload usa pro webhook do Sheets — aqui é
// só leitura pra exibir no card do CRM, sem duplicar o payload inteiro.
async function resolveFunnelOrigin(
  supabase: any,
  funnelId: string | null,
  answers: Record<string, unknown> | null,
) {
  if (!funnelId) return { funnelName: null, answers: [] as Array<{ question: string; answer: string }> };
  const [{ data: funnel }, { data: steps }] = await Promise.all([
    supabase.from("funnels").select("name").eq("id", funnelId).maybeSingle(),
    supabase
      .from("funnel_steps")
      .select("id, type, config, order")
      .eq("funnel_id", funnelId)
      .order("order", { ascending: true }),
  ]);
  const answersIn = (answers ?? {}) as Record<string, unknown>;
  const pretty: Array<{ question: string; answer: string }> = [];
  for (const s of (steps ?? []) as Array<{ id: string; type: string; config: any; order: number }>) {
    if (s.type === "contact") {
      const f = (s.config?.fields ?? {}) as Record<string, unknown>;
      if (f.city === true && answersIn["Cidade"]) pretty.push({ question: "Cidade", answer: String(answersIn["Cidade"]) });
      if (f.neighborhood === true && answersIn["Bairro"]) pretty.push({ question: "Bairro", answer: String(answersIn["Bairro"]) });
      continue;
    }
    if (s.type === "lead" || s.type === "text") continue;
    const raw = answersIn[`step_${s.id}`];
    if (raw === undefined || raw === null || raw === "") continue;
    const title = (s.config?.title as string) || `Etapa ${s.order ?? ""}`.trim();
    pretty.push({ question: title, answer: Array.isArray(raw) ? raw.join(", ") : String(raw) });
  }
  return { funnelName: funnel?.name ?? null, answers: pretty };
}

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

// Best-effort: a falha em gravar um evento de timeline nunca pode derrubar a ação
// principal (mover card, atribuir, etiquetar) — timeline é suplementar.
async function logEvent(
  supabase: any,
  cardId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  try {
    await supabase.from("crm_events").insert({ lead_card_id: cardId, type, payload });
  } catch (err) {
    console.error("[crm] falha ao gravar evento de timeline", err);
  }
}

const STAGE_COLORS = ["blue", "amber", "violet", "cyan", "emerald", "rose", "slate"];

async function assertCrmAccess(supabase: any, userId: string) {
  if (await isAdminUser(userId)) return;

  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, price_id, product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const ok = (data ?? []).some((s: any) => {
    const matchesCrm = s.price_id === "crm_addon_monthly" || s.product_id === "crm_addon";
    if (!matchesCrm) return false;
    const endOk = !s.current_period_end || new Date(s.current_period_end) > new Date();
    return (
      (["active", "trialing"].includes(s.status) && endOk) || (s.status === "canceled" && endOk)
    );
  });
  if (!ok) throw new Error("CRM add-on inativo");
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
    if (await isAdminUser(userId)) return { hasAccess: true, env, source: "admin" };

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
      return (
        (["active", "trialing"].includes(s.status) && endOk) || (s.status === "canceled" && endOk)
      );
    });
    return { hasAccess: isActive, env };
  });

export const ensureDefaultPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
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

export const listPipelines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data } = await supabase
      .from("crm_pipelines")
      .select("id, name, is_default, created_at")
      .eq("owner_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    return { pipelines: data ?? [] };
  });

export const createPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => {
    const name = d?.name?.trim();
    if (!name) throw new Error("Dê um nome para o pipeline");
    if (name.length > 80) throw new Error("Nome muito longo");
    return { name };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: pipeline, error } = await supabase
      .from("crm_pipelines")
      .insert({ owner_id: userId, name: data.name, is_default: false })
      .select("id")
      .single();
    if (error || !pipeline) throw new Error(error?.message ?? "Falha ao criar pipeline");

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

export const renamePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pipelineId: string; name: string }) => {
    const name = d?.name?.trim();
    if (!d?.pipelineId || !name) throw new Error("Dados inválidos");
    if (name.length > 80) throw new Error("Nome muito longo");
    return { pipelineId: d.pipelineId, name };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { error } = await supabase
      .from("crm_pipelines")
      .update({ name: data.name })
      .eq("id", data.pipelineId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pipelineId: string }) => {
    if (!d?.pipelineId) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: pipeline } = await supabase
      .from("crm_pipelines")
      .select("id, is_default")
      .eq("id", data.pipelineId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!pipeline) throw new Error("Pipeline não encontrado");
    if (pipeline.is_default) throw new Error("O pipeline principal não pode ser excluído");

    const { count } = await supabase
      .from("crm_lead_cards")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", data.pipelineId);
    if ((count ?? 0) > 0)
      throw new Error("Mova os cards para outro pipeline antes de excluir este");

    // Apaga etapas antes do pipeline — não depende de ON DELETE CASCADE existir.
    const { error: stagesError } = await supabase
      .from("crm_stages")
      .delete()
      .eq("pipeline_id", data.pipelineId);
    if (stagesError) throw new Error(stagesError.message);
    const { error } = await supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", data.pipelineId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pipelineId: string; name: string; color?: string }) => {
    const name = d?.name?.trim();
    if (!d?.pipelineId || !name) throw new Error("Dados inválidos");
    if (name.length > 60) throw new Error("Nome muito longo");
    const color = STAGE_COLORS.includes(d.color ?? "") ? d.color! : "slate";
    return { pipelineId: d.pipelineId, name, color };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: pipeline } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("id", data.pipelineId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!pipeline) throw new Error("Pipeline não encontrado");

    const { count } = await supabase
      .from("crm_stages")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", data.pipelineId);
    const { data: stage, error } = await supabase
      .from("crm_stages")
      .insert({
        pipeline_id: data.pipelineId,
        name: data.name,
        color: data.color,
        order: count ?? 0,
      })
      .select("id")
      .single();
    if (error || !stage) throw new Error(error?.message ?? "Falha ao criar etapa");
    return { stageId: stage.id as string };
  });

export const renameStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stageId: string; name: string; color?: string }) => {
    const name = d?.name?.trim();
    if (!d?.stageId || !name) throw new Error("Dados inválidos");
    if (name.length > 60) throw new Error("Nome muito longo");
    if (d.color && !STAGE_COLORS.includes(d.color)) throw new Error("Cor inválida");
    return { stageId: d.stageId, name, color: d.color };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    // Confere que a etapa pertence a um pipeline do próprio dono antes de escrever.
    const { data: stage } = await supabase
      .from("crm_stages")
      .select("id, pipeline_id, crm_pipelines!inner(owner_id)")
      .eq("id", data.stageId)
      .maybeSingle();
    if (!stage || (stage as any).crm_pipelines.owner_id !== userId)
      throw new Error("Etapa não encontrada");

    const patch = data.color ? { name: data.name, color: data.color } : { name: data.name };
    const { error } = await supabase.from("crm_stages").update(patch).eq("id", data.stageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pipelineId: string; orderedStageIds: string[] }) => {
    if (!d?.pipelineId || !Array.isArray(d?.orderedStageIds) || !d.orderedStageIds.length) {
      throw new Error("Dados inválidos");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: pipeline } = await supabase
      .from("crm_pipelines")
      .select("id")
      .eq("id", data.pipelineId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!pipeline) throw new Error("Pipeline não encontrado");

    // Sequencial de propósito — são poucas etapas por pipeline, e assim cada
    // update já sai filtrado pelo pipeline_id certo, sem risco de mexer em
    // etapa de outro pipeline por engano.
    for (let i = 0; i < data.orderedStageIds.length; i++) {
      const { error } = await supabase
        .from("crm_stages")
        .update({ order: i })
        .eq("id", data.orderedStageIds[i])
        .eq("pipeline_id", data.pipelineId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stageId: string }) => {
    if (!d?.stageId) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: stage } = await supabase
      .from("crm_stages")
      .select("id, pipeline_id, crm_pipelines!inner(owner_id)")
      .eq("id", data.stageId)
      .maybeSingle();
    if (!stage || (stage as any).crm_pipelines.owner_id !== userId)
      throw new Error("Etapa não encontrada");

    const { count: stageCount } = await supabase
      .from("crm_stages")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", (stage as any).pipeline_id);
    if ((stageCount ?? 0) <= 1) throw new Error("O pipeline precisa de pelo menos uma etapa");

    const { count: cardCount } = await supabase
      .from("crm_lead_cards")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", data.stageId);
    if ((cardCount ?? 0) > 0) throw new Error("Mova os cards desta etapa antes de excluí-la");

    const { error } = await supabase.from("crm_stages").delete().eq("id", data.stageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Marca qual(is) etapa(s) do pipeline disparam o modal de agendamento ao
// receber um card — deliberadamente por flag, não por nome da etapa, porque
// etapas são renomeáveis livremente por cada clínica (ver docs/crm-plano.md).
export const setStageSchedulingFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { stageId: string; triggersScheduling: boolean }) => {
    if (!d?.stageId || typeof d.triggersScheduling !== "boolean")
      throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: stage } = await supabase
      .from("crm_stages")
      .select("id, crm_pipelines!inner(owner_id)")
      .eq("id", data.stageId)
      .maybeSingle();
    if (!stage || (stage as any).crm_pipelines.owner_id !== userId)
      throw new Error("Etapa não encontrada");
    const { error } = await supabase
      .from("crm_stages")
      .update({ triggers_scheduling: data.triggersScheduling } as any)
      .eq("id", data.stageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pipelineId?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
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
      (supabase as any)
        .from("crm_stages")
        .select("id, name, color, order, triggers_scheduling")
        .eq("pipeline_id", pipelineId)
        .order("order", { ascending: true }),
      supabase
        .from("crm_lead_cards")
        .select(
          "id, stage_id, position, status, assignee_id, moved_at, lead_id, tags, leads!inner(id, name, email, phone, created_at)",
        )
        .eq("pipeline_id", pipelineId)
        .eq("status", "active")
        .order("position", { ascending: true }),
    ]);

    const cardIds = (cards ?? []).map((c: any) => c.id);
    const { data: appts } = cardIds.length
      ? await (supabase as any)
          .from("crm_appointments")
          .select("lead_card_id, scheduled_at, evaluator_id")
          .in("lead_card_id", cardIds)
      : { data: [] as any[] };
    const apptByCard = new Map<string, any>((appts ?? []).map((a: any) => [a.lead_card_id, a]));

    return {
      pipelineId,
      stages: (stages ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        order: s.order,
        triggersScheduling: s.triggers_scheduling,
      })),
      cards: (cards ?? []).map((c: any) => {
        const appt = apptByCard.get(c.id);
        return {
          id: c.id,
          stageId: c.stage_id,
          position: c.position,
          assigneeId: c.assignee_id,
          movedAt: c.moved_at,
          tags: c.tags ?? [],
          appointment: appt
            ? { scheduledAt: appt.scheduled_at, evaluatorId: appt.evaluator_id }
            : null,
          lead: {
            id: c.leads.id,
            name: c.leads.name,
            email: c.leads.email,
            phone: c.leads.phone,
            createdAt: c.leads.created_at,
          },
        };
      }),
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
    await assertCrmAccess(supabase, userId);
    await assertCardOwnership(supabase, userId, data.cardId);
    const { data: before } = await supabase
      .from("crm_lead_cards")
      .select("stage_id")
      .eq("id", data.cardId)
      .maybeSingle();
    const { error } = await supabase
      .from("crm_lead_cards")
      .update({
        stage_id: data.stageId,
        position: data.position,
        moved_at: new Date().toISOString(),
      })
      .eq("id", data.cardId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    if (before && before.stage_id !== data.stageId) {
      await logEvent(supabase, data.cardId, "stage_changed", {
        fromStageId: before.stage_id,
        toStageId: data.stageId,
      });
    }
    return { ok: true };
  });

export const upsertAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cardId: string; scheduledAt: string; evaluatorId: string | null }) => {
    if (!d?.cardId || !d?.scheduledAt) throw new Error("Dados inválidos");
    const when = new Date(d.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Data/hora inválida");
    return { cardId: d.cardId, scheduledAt: when.toISOString(), evaluatorId: d.evaluatorId ?? null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    await assertCardOwnership(supabase, userId, data.cardId);
    if (data.evaluatorId && data.evaluatorId !== userId) {
      const { data: member } = await supabase
        .from("crm_members")
        .select("id")
        .eq("owner_id", userId)
        .eq("user_id", data.evaluatorId)
        .maybeSingle();
      if (!member) throw new Error("Esse avaliador não faz parte da sua equipe");
    }
    const { error } = await (supabase as any).from("crm_appointments").upsert(
      {
        lead_card_id: data.cardId,
        scheduled_at: data.scheduledAt,
        evaluator_id: data.evaluatorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "lead_card_id" },
    );
    if (error) throw new Error(error.message);
    await logEvent(supabase, data.cardId, "appointment_scheduled", {
      scheduledAt: data.scheduledAt,
      evaluatorId: data.evaluatorId,
    });
    return { ok: true };
  });

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data } = await (supabase as any)
      .from("crm_appointments")
      .select(
        "id, scheduled_at, evaluator_id, lead_card_id, crm_lead_cards!inner(pipeline_id, status, leads!inner(name, phone, email), crm_stages!inner(name, color), crm_pipelines!inner(name))",
      )
      .eq("crm_lead_cards.status", "active")
      .order("scheduled_at", { ascending: true });
    return {
      appointments: (data ?? []).map((a: any) => ({
        id: a.id,
        scheduledAt: a.scheduled_at,
        evaluatorId: a.evaluator_id,
        cardId: a.lead_card_id,
        pipelineId: a.crm_lead_cards.pipeline_id,
        pipelineName: a.crm_lead_cards.crm_pipelines?.name ?? "—",
        stageName: a.crm_lead_cards.crm_stages?.name ?? "—",
        stageColor: a.crm_lead_cards.crm_stages?.color ?? "slate",
        lead: {
          name: a.crm_lead_cards.leads?.name ?? null,
          phone: a.crm_lead_cards.leads?.phone ?? null,
          email: a.crm_lead_cards.leads?.email ?? null,
        },
      })),
    };
  });

export const listClosedDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data } = await (supabase as any)
      .from("crm_closed_dates")
      .select("date, reason, start_time, end_time")
      .eq("owner_id", userId)
      .order("date", { ascending: true });
    return {
      closedDates: (data ?? []).map((d: any) => ({
        date: d.date,
        reason: d.reason,
        startTime: d.start_time,
        endTime: d.end_time,
      })),
    };
  });

// Abrir/fechar um dia (ou uma faixa de horário dentro dele) é sempre do dono
// da conta (mesma trava de assertCrmAccess das outras configurações de
// pipeline) — não é uma ação por card, então não passa por assertCardOwnership.
// startTime/endTime ausentes = fecha o dia inteiro; presentes = só aquela
// janela (ex.: almoço), guardado na mesma linha (uma regra por data).
const HHMM = /^\d{2}:\d{2}$/;
export const setDateClosed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      date: string;
      closed: boolean;
      reason?: string | null;
      startTime?: string | null;
      endTime?: string | null;
    }) => {
      if (!d?.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw new Error("Data inválida");
      if (typeof d.closed !== "boolean") throw new Error("Dados inválidos");
      const startTime = d.startTime?.trim() || null;
      const endTime = d.endTime?.trim() || null;
      if ((startTime && !HHMM.test(startTime)) || (endTime && !HHMM.test(endTime))) {
        throw new Error("Horário inválido");
      }
      if ((startTime && !endTime) || (!startTime && endTime)) {
        throw new Error("Informe início e fim do horário");
      }
      if (startTime && endTime && startTime >= endTime) {
        throw new Error("Horário final precisa ser depois do inicial");
      }
      return { date: d.date, closed: d.closed, reason: d.reason?.trim() || null, startTime, endTime };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    if (data.closed) {
      const { error } = await (supabase as any).from("crm_closed_dates").upsert(
        {
          owner_id: userId,
          date: data.date,
          reason: data.reason,
          start_time: data.startTime,
          end_time: data.endTime,
        },
        { onConflict: "owner_id,date" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (supabase as any)
        .from("crm_closed_dates")
        .delete()
        .eq("owner_id", userId)
        .eq("date", data.date);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { data: funnels } = await supabase
      .from("funnels")
      .select("id, name")
      .eq("owner_id", userId);
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
    await assertCrmAccess(supabase, userId);
    const { data: card } = await supabase
      .from("crm_lead_cards")
      .select(
        "id, stage_id, position, status, assignee_id, lead_id, tags, leads!inner(id, name, email, phone, created_at, answers, utm, funnel_id)",
      )
      .eq("id", data.cardId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!card) throw new Error("Card não encontrado");
    const leadRow = (card as any).leads as { funnel_id: string | null; answers: any; utm: any };
    const [{ data: notes }, { data: events }, origin, { data: appointment }] = await Promise.all([
      supabase
        .from("crm_notes")
        .select("id, body, author_id, created_at")
        .eq("lead_card_id", data.cardId)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_events")
        .select("id, type, payload, created_at")
        .eq("lead_card_id", data.cardId)
        .order("created_at", { ascending: false }),
      resolveFunnelOrigin(supabase, leadRow?.funnel_id ?? null, leadRow?.answers ?? null),
      (supabase as any)
        .from("crm_appointments")
        .select("scheduled_at, evaluator_id")
        .eq("lead_card_id", data.cardId)
        .maybeSingle(),
    ]);
    return { card, notes: notes ?? [], events: events ?? [], origin, appointment: appointment ?? null };
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
    await assertCrmAccess(supabase, userId);
    await assertCardOwnership(supabase, userId, data.cardId);
    const { error } = await supabase
      .from("crm_notes")
      .insert({ lead_card_id: data.cardId, author_id: userId, body: data.body.trim() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCardTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cardId: string; tags: string[] }) => {
    if (!d?.cardId || !Array.isArray(d?.tags)) throw new Error("Dados inválidos");
    const tags = [...new Set(d.tags.map((t) => t.trim()).filter(Boolean))];
    if (tags.length > 10) throw new Error("No máximo 10 etiquetas por card");
    if (tags.some((t) => t.length > 30)) throw new Error("Etiqueta muito longa");
    return { cardId: d.cardId, tags };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    await assertCardOwnership(supabase, userId, data.cardId);
    // `tags` é coluna nova (migração direta, fora do fluxo do Lovable) — ainda
    // não existe em types.ts gerado, daí o cast. Ver CLAUDE.md "Pegadinha types.ts".
    const { error } = await supabase
      .from("crm_lead_cards")
      .update({ tags: data.tags } as any)
      .eq("id", data.cardId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    await logEvent(supabase, data.cardId, "tags_changed", { tags: data.tags });
    return { ok: true };
  });

export const assignCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cardId: string; assigneeId: string | null }) => {
    if (!d?.cardId) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    await assertCardOwnership(supabase, userId, data.cardId);
    if (data.assigneeId && data.assigneeId !== userId) {
      const { data: member } = await supabase
        .from("crm_members")
        .select("id")
        .eq("owner_id", userId)
        .eq("user_id", data.assigneeId)
        .maybeSingle();
      if (!member) throw new Error("Esse atendente não faz parte da sua equipe");
    }
    const { error } = await supabase
      .from("crm_lead_cards")
      .update({ assignee_id: data.assigneeId })
      .eq("id", data.cardId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    await logEvent(supabase, data.cardId, "assigned", { assigneeId: data.assigneeId });
    return { ok: true };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    await assertCrmAccess(supabase, userId);
    const { data: members } = await supabase
      .from("crm_members")
      .select("id, user_id, role")
      .eq("owner_id", userId);

    // Resolver email por auth.admin, não por uma tabela de perfil — a única
    // "profiles" que existe é perfil de clínica, não de identidade de usuário.
    const memberEmails = await Promise.all(
      (members ?? []).map(async (m: any) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        return data.user?.email ?? "—";
      }),
    );

    return {
      members: [
        { memberId: null, userId, email: (claims as any)?.email ?? "Você", role: "owner" as const },
        ...(members ?? []).map((m: any, i: number) => ({
          memberId: m.id as string,
          userId: m.user_id,
          email: memberEmails[i],
          role: m.role as string,
        })),
      ],
    };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "admin" | "agent" }) => {
    const email = d?.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("Email inválido");
    if (d.role !== "admin" && d.role !== "agent") throw new Error("Papel inválido");
    return { email, role: d.role };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);

    const { data: foundId, error: lookupError } = await supabaseAdmin.rpc(
      "get_user_id_by_email" as never,
      { lookup_email: data.email } as never,
    );
    if (lookupError) throw new Error("Não foi possível buscar esse email agora. Tente de novo.");
    if (!foundId) {
      throw new Error(
        "Não encontramos uma conta com esse email. Peça pra essa pessoa criar uma conta na Clinik.Club primeiro.",
      );
    }
    if (foundId === userId) throw new Error("Você já tem acesso total — não precisa se convidar.");

    const { error } = await supabase
      .from("crm_members")
      .insert({ owner_id: userId, user_id: foundId, role: data.role });
    if (error) {
      if ((error as any).code === "23505")
        throw new Error("Essa pessoa já faz parte da sua equipe.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; role: "admin" | "agent" }) => {
    if (!d?.memberId) throw new Error("Dados inválidos");
    if (d.role !== "admin" && d.role !== "agent") throw new Error("Papel inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { error } = await supabase
      .from("crm_members")
      .update({ role: data.role })
      .eq("id", data.memberId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => {
    if (!d?.memberId) throw new Error("Dados inválidos");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);
    const { error } = await supabase
      .from("crm_members")
      .delete()
      .eq("id", data.memberId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function ensureImportFunnel(userId: string): Promise<string> {
  const slug = crmImportFunnelSlug(userId);
  const { data: existing } = await supabaseAdmin
    .from("funnels")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabaseAdmin
    .from("funnels")
    .insert({
      owner_id: userId,
      name: "Contatos importados (CRM)",
      slug,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !created) {
    // Corrida: outro import concorrente já criou. Busca de novo em vez de falhar.
    const { data: again } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (again) return again.id as string;
    throw new Error(error?.message ?? "Falha ao preparar importação");
  }
  return created.id as string;
}

const MAX_IMPORT_ROWS = 500;

export const importContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      pipelineId: string;
      stageId: string;
      rows: { name?: string; email?: string; phone?: string }[];
    }) => {
      if (!d?.pipelineId || !d?.stageId) throw new Error("Escolha o pipeline e a etapa de destino");
      if (!Array.isArray(d.rows) || !d.rows.length) throw new Error("Nenhuma linha para importar");
      if (d.rows.length > MAX_IMPORT_ROWS) {
        throw new Error(`Máximo de ${MAX_IMPORT_ROWS} contatos por importação.`);
      }
      const rows = d.rows
        .map((r) => ({
          name: r.name?.trim() || null,
          email: r.email?.trim() || null,
          phone: r.phone?.trim() || null,
        }))
        .filter((r) => r.name || r.email || r.phone);
      if (!rows.length) throw new Error("Nenhuma linha tem nome, email ou telefone preenchido");
      return { pipelineId: d.pipelineId, stageId: d.stageId, rows };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCrmAccess(supabase, userId);

    const { data: stage } = await supabase
      .from("crm_stages")
      .select("id, pipeline_id, crm_pipelines!inner(owner_id)")
      .eq("id", data.stageId)
      .eq("pipeline_id", data.pipelineId)
      .maybeSingle();
    if (!stage || (stage as any).crm_pipelines.owner_id !== userId) {
      throw new Error("Pipeline ou etapa inválidos");
    }

    const funnelId = await ensureImportFunnel(userId);

    const { data: newLeads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .insert(
        data.rows.map((r) => ({
          funnel_id: funnelId,
          name: r.name,
          email: r.email,
          phone: r.phone,
          status: "completed",
        })),
      )
      .select("id");
    if (leadsError || !newLeads)
      throw new Error(leadsError?.message ?? "Falha ao importar contatos");

    const { count: existingCount } = await supabase
      .from("crm_lead_cards")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", data.stageId);
    let position = existingCount ?? 0;

    // Upsert, não insert: um trigger (trg_leads_create_crm_card) já cria um
    // card automaticamente no pipeline padrão assim que o lead é inserido.
    // Se o destino escolhido aqui for o pipeline padrão, esse card já existe
    // (mesmo lead_id + pipeline_id) — upsert move ele pra etapa escolhida em
    // vez de colidir com a constraint única. Se for outro pipeline, insere
    // normal (o card do padrão continua existindo à parte, mesmo comportamento
    // de qualquer lead vindo de funil).
    const { error: cardsError } = await supabaseAdmin.from("crm_lead_cards").upsert(
      newLeads.map((lead: any) => ({
        owner_id: userId,
        lead_id: lead.id,
        pipeline_id: data.pipelineId,
        stage_id: data.stageId,
        position: position++,
        status: "active",
      })),
      { onConflict: "lead_id,pipeline_id" },
    );
    if (cardsError) throw new Error(cardsError.message);

    return { imported: newLeads.length };
  });
