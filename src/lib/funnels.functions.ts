import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPlanLimits, FREE_LIMITS } from "@/lib/plan-limits";

function getPaymentsEnv(): string {
  return (process.env.PAYMENTS_ENV ?? "sandbox") as string;
}

const MAX_JSON_BYTES = 50_000;
function assertJsonSize(obj: unknown, field: string) {
  try {
    const s = JSON.stringify(obj ?? {});
    if (s.length > MAX_JSON_BYTES) {
      throw new Error(`Campo ${field} excede o limite de ${MAX_JSON_BYTES} bytes`);
    }
  } catch (e: any) {
    if (e?.message?.startsWith("Campo ")) throw e;
    throw new Error(`Campo ${field} inválido`);
  }
}

function getClientIp(): string | null {
  try {
    const req = getRequest();
    const h = req?.headers;
    if (!h) return null;
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
    const cf = h.get("cf-connecting-ip");
    if (cf) return cf.slice(0, 64);
    const real = h.get("x-real-ip");
    if (real) return real.slice(0, 64);
    return null;
  } catch {
    return null;
  }
}

async function checkAndLogRate(action: string, opts: {
  sessionId?: string | null;
  funnelId?: string | null;
  windowSec: number;
  maxPerSession: number;
  maxPerIp: number;
}) {
  const ip = getClientIp();
  const since = new Date(Date.now() - opts.windowSec * 1000).toISOString();
  if (opts.sessionId) {
    const { count } = await supabaseAdmin
      .from("public_action_log")
      .select("id", { count: "exact", head: true })
      .eq("action", action)
      .eq("session_id", opts.sessionId)
      .gte("created_at", since);
    if ((count ?? 0) >= opts.maxPerSession) {
      throw new Error("Muitas requisições. Tente novamente em instantes.");
    }
  }
  if (ip) {
    const { count } = await supabaseAdmin
      .from("public_action_log")
      .select("id", { count: "exact", head: true })
      .eq("action", action)
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= opts.maxPerIp) {
      throw new Error("Muitas requisições. Tente novamente em instantes.");
    }
  }
  await supabaseAdmin.from("public_action_log").insert({
    action,
    session_id: opts.sessionId ?? null,
    ip,
    funnel_id: opts.funnelId ?? null,
  });
}

async function getActivePriceId(userId: string, env: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .eq("environment", env)
    .order("created_at", { ascending: false });
  const row = (data ?? []).find((s: any) => {
    const endOk = !s.current_period_end || new Date(s.current_period_end) > new Date();
    return (["active", "trialing"].includes(s.status) && endOk) || (s.status === "canceled" && endOk);
  });
  return (row?.price_id as string | undefined) ?? null;
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countLeadsThisMonthForOwner(ownerId: string): Promise<number> {
  const { data: funnels } = await supabaseAdmin
    .from("funnels")
    .select("id")
    .eq("owner_id", ownerId);
  const ids = (funnels ?? []).map((f: any) => f.id);
  if (!ids.length) return 0;
  const { count } = await supabaseAdmin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .in("funnel_id", ids)
    .eq("status", "completed")
    .gte("created_at", startOfMonthIso());
  return count ?? 0;
}

async function postToSheetsWebhook(funnelId: string, payload: Record<string, unknown>) {
  try {
    const { data: f } = await supabaseAdmin
      .from("funnels")
      .select("sheets_webhook_url")
      .eq("id", funnelId)
      .maybeSingle();
    const url = (f as any)?.sheets_webhook_url as string | null | undefined;
    if (!url) return;
    if (!/^https:\/\/script\.google\.com\//.test(url)) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "follow",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[sheets-webhook] non-2xx", res.status, text.slice(0, 300));
      }
    } catch (e: any) {
      console.error("[sheets-webhook] fetch error", e?.message ?? e);
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    console.error("[sheets-webhook] lookup error", e);
  }
}

export const getPublicFunnel = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => {
    if (!d?.slug || typeof d.slug !== "string" || d.slug.length > 200) throw new Error("slug inválido");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: funnel, error } = await supabaseAdmin
      .from("funnels")
      .select("id, name, slug, status, theme, owner_id, gtm_id, meta_pixel_id")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!funnel) return { funnel: null, steps: [] as Array<{ id: string; type: string; config: any; order: number }> };
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("clinic_name, clinic_logo_url, instagram_url")
      .eq("id", funnel.owner_id)
      .maybeSingle();
    const { owner_id: _ownerId, ...publicFunnel } = funnel as any;
    const enriched = {
      ...publicFunnel,
      clinic_name: profile?.clinic_name ?? null,
      clinic_logo_url: profile?.clinic_logo_url ?? null,
      instagram_url: profile?.instagram_url ?? null,
    };
    const { data: steps } = await supabaseAdmin
      .from("funnel_steps")
      .select("id, type, config, order")
      .eq("funnel_id", funnel.id)
      .order("order", { ascending: true });
    return { funnel: enriched, steps: (steps ?? []) as Array<{ id: string; type: string; config: any; order: number }> };
  });

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d: { funnelId: string; sessionId?: string; answers: Record<string, unknown>; email?: string; name?: string; phone?: string; utm?: Record<string, unknown> }) => {
    if (!d?.funnelId) throw new Error("funnelId obrigatório");
    assertJsonSize(d.answers, "answers");
    assertJsonSize(d.utm, "utm");
    return d;
  })
  .handler(async ({ data }) => {
    await checkAndLogRate("submitLead", {
      sessionId: data.sessionId ?? null,
      funnelId: data.funnelId,
      windowSec: 60,
      maxPerSession: 5,
      maxPerIp: 30,
    });
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id, owner_id")
      .eq("id", data.funnelId)
      .eq("status", "published")
      .maybeSingle();
    if (!funnel) throw new Error("Funil não encontrado");
    // Enforce monthly lead cap of the funnel owner's plan.
    // Allow updates to an existing lead row (same session_id), but block new completed leads beyond the limit.
    const ownerId = (funnel as any).owner_id as string;
    const env = getPaymentsEnv();
    const ownerPriceId = await getActivePriceId(ownerId, env);
    const ownerLimits = getPlanLimits(ownerPriceId);
    if (ownerLimits.maxLeadsPerMonth === 0) {
      throw new Error("Este funil está temporariamente indisponível. Tente novamente mais tarde.");
    }
    let isExisting = false;
    if (data.sessionId) {
      const { data: existingLead } = await supabaseAdmin
        .from("leads")
        .select("id, status")
        .eq("funnel_id", data.funnelId)
        .eq("session_id", data.sessionId)
        .maybeSingle();
      isExisting = !!existingLead && (existingLead as any).status === "completed";
    }
    if (!isExisting) {
      const used = await countLeadsThisMonthForOwner(ownerId);
      if (used >= ownerLimits.maxLeadsPerMonth) {
        throw new Error("Limite mensal de leads deste funil atingido. Tente novamente no próximo mês.");
      }
    }
    if (data.sessionId) {
      const { error } = await supabaseAdmin.from("leads").upsert({
        funnel_id: data.funnelId,
        session_id: data.sessionId,
        email: data.email ?? null,
        name: data.name ?? null,
        phone: data.phone ?? null,
        answers: (data.answers ?? {}) as any,
        utm: (data.utm ?? {}) as any,
        status: "completed",
      }, { onConflict: "funnel_id,session_id" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("leads").insert({
        funnel_id: data.funnelId,
        email: data.email ?? null,
        name: data.name ?? null,
        phone: data.phone ?? null,
        answers: (data.answers ?? {}) as any,
        utm: (data.utm ?? {}) as any,
        status: "completed",
      });
      if (error) throw new Error(error.message);
    }
    // Build friendly answers (question title -> answer label) for sheet columns
    const { data: steps } = await supabaseAdmin
      .from("funnel_steps")
      .select("id, type, config, order")
      .eq("funnel_id", data.funnelId)
      .order("order", { ascending: true });
    const answersIn = (data.answers ?? {}) as Record<string, unknown>;
    const questions: string[] = [];
    const answers_pretty: Record<string, unknown> = {};
    for (const s of (steps ?? []) as Array<{ id: string; type: string; config: any; order: number }>) {
      if (s.type === "contact" || s.type === "lead" || s.type === "text") continue;
      const title = (s.config?.title as string) || `Etapa ${s.order ?? ""}`.trim();
      const key = `step_${s.id}`;
      const raw = answersIn[key];
      questions.push(title);
      answers_pretty[title] = Array.isArray(raw) ? raw.join(", ") : (raw ?? "");
    }
    await postToSheetsWebhook(data.funnelId, {
      type: "lead",
      status: "completed",
      funnel_id: data.funnelId,
      session_id: data.sessionId ?? null,
      name: data.name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      answers: data.answers ?? {},
      answers_pretty,
      questions,
      utm: data.utm ?? {},
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const upsertPartialLead = createServerFn({ method: "POST" })
  .inputValidator((d: {
    funnelId: string;
    sessionId: string;
    stepIndex: number;
    answers?: Record<string, unknown>;
    email?: string;
    name?: string;
    phone?: string;
    utm?: Record<string, unknown>;
  }) => {
    if (!d?.funnelId) throw new Error("funnelId obrigatório");
    if (!d?.sessionId || typeof d.sessionId !== "string" || d.sessionId.length > 200) throw new Error("sessionId inválido");
    if (typeof d.stepIndex !== "number") throw new Error("stepIndex inválido");
    assertJsonSize(d.answers ?? {}, "answers");
    assertJsonSize(d.utm ?? {}, "utm");
    // sanity caps to prevent abuse
    const cap = (v: string | undefined, n: number) => (v ? String(v).slice(0, n) : null);
    return {
      funnelId: d.funnelId,
      sessionId: d.sessionId,
      stepIndex: d.stepIndex,
      answers: d.answers ?? {},
      utm: d.utm ?? {},
      email: cap(d.email, 255),
      name: cap(d.name, 200),
      phone: cap(d.phone, 40),
    };
  })
  .handler(async ({ data }) => {
    await checkAndLogRate("upsertPartialLead", {
      sessionId: data.sessionId,
      funnelId: data.funnelId,
      windowSec: 60,
      maxPerSession: 60,
      maxPerIp: 200,
    });
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("id", data.funnelId)
      .eq("status", "published")
      .maybeSingle();
    if (!funnel) return { ok: false };

    // Only update status to 'partial' on insert; never downgrade a completed lead.
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id, status, answers")
      .eq("funnel_id", data.funnelId)
      .eq("session_id", data.sessionId)
      .maybeSingle();

    const mergedAnswers = { ...((existing?.answers as any) ?? {}), ...(data.answers ?? {}) };

    if (existing) {
      const patch = {
        answers: mergedAnswers as any,
        last_step_index: data.stepIndex,
        ...(data.email ? { email: data.email } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(Object.keys(data.utm).length ? { utm: data.utm as any } : {}),
      };
      const { error } = await supabaseAdmin.from("leads").update(patch).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("leads").insert({
        funnel_id: data.funnelId,
        session_id: data.sessionId,
        email: data.email,
        name: data.name,
        phone: data.phone,
        answers: mergedAnswers as any,
        utm: data.utm as any,
        status: "partial",
        last_step_index: data.stepIndex,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const trackStep = createServerFn({ method: "POST" })
  .inputValidator((d: { funnelId: string; sessionId: string; stepIndex: number; completed?: boolean }) => {
    if (!d || typeof d !== "object") throw new Error("payload inválido");
    if (typeof d.funnelId !== "string" || !/^[0-9a-f-]{36}$/i.test(d.funnelId)) {
      throw new Error("funnelId inválido");
    }
    if (typeof d.sessionId !== "string" || d.sessionId.length < 1 || d.sessionId.length > 200) {
      throw new Error("sessionId inválido");
    }
    if (typeof d.stepIndex !== "number" || !Number.isFinite(d.stepIndex) || d.stepIndex < 0 || d.stepIndex > 1000) {
      throw new Error("stepIndex inválido");
    }
    return {
      funnelId: d.funnelId,
      sessionId: d.sessionId,
      stepIndex: Math.floor(d.stepIndex),
      completed: !!d.completed,
    };
  })
  .handler(async ({ data }) => {
    await checkAndLogRate("trackStep", {
      sessionId: data.sessionId,
      funnelId: data.funnelId,
      windowSec: 60,
      maxPerSession: 120,
      maxPerIp: 400,
    });
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("id", data.funnelId)
      .eq("status", "published")
      .maybeSingle();
    if (!funnel) return { ok: false };
    await supabaseAdmin.from("funnel_responses").insert({
      funnel_id: data.funnelId,
      session_id: data.sessionId,
      step_index: data.stepIndex,
      completed: !!data.completed,
    });
    return { ok: true };
  });

export const deleteFunnel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ funnelId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: funnel, error: fetchErr } = await supabaseAdmin
      .from("funnels")
      .select("id, owner_id")
      .eq("id", data.funnelId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!funnel) throw new Error("Funil não encontrado");
    if ((funnel as any).owner_id !== userId) {
      throw new Error("Você não tem permissão para excluir este funil.");
    }
    const { error } = await supabaseAdmin
      .from("funnels")
      .delete()
      .eq("id", data.funnelId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createFunnelChecked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().trim().min(1).max(120),
      slug: z
        .string()
        .trim()
        .min(1)
        .max(80)
        .regex(/^[a-z0-9-]+$/, "slug inválido"),
    }),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const env = getPaymentsEnv();
    const priceId = await getActivePriceId(userId, env);
    const limits = getPlanLimits(priceId);
    if (limits.maxFunnels === 0) {
      throw new Error("Você precisa de um plano ativo para criar funis.");
    }
    const { count } = await supabaseAdmin
      .from("funnels")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    const used = count ?? 0;
    if (used >= limits.maxFunnels) {
      throw new Error(
        `Seu plano (${limits.tier}) permite até ${limits.maxFunnels} funil${limits.maxFunnels > 1 ? "s" : ""}. Faça upgrade para criar mais.`,
      );
    }
    const { data: row, error } = await supabaseAdmin
      .from("funnels")
      .insert({ name: data.name, slug: data.slug, owner_id: userId })
      .select()
      .single();
    if (error) {
      if ((error as any).code === "23505" || /duplicate|unique/i.test(error.message)) {
        throw new Error("Já existe um funil com esse nome. Escolha outro.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const getPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const env = getPaymentsEnv();
    const priceId = await getActivePriceId(userId, env);
    const limits = getPlanLimits(priceId);
    const { count } = await supabaseAdmin
      .from("funnels")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId);
    const leadsUsedThisMonth = await countLeadsThisMonthForOwner(userId);
    return {
      tier: limits.tier,
      hasPlan: limits !== FREE_LIMITS,
      maxFunnels: Number.isFinite(limits.maxFunnels) ? limits.maxFunnels : null,
      maxLeadsPerMonth: limits.maxLeadsPerMonth,
      funnelsUsed: count ?? 0,
      leadsUsedThisMonth,
    };
  });
