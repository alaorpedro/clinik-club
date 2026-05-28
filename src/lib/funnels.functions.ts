import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

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
    const enriched = {
      ...funnel,
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
    return d;
  })
  .handler(async ({ data }) => {
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("id", data.funnelId)
      .eq("status", "published")
      .maybeSingle();
    if (!funnel) throw new Error("Funil não encontrado");
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
  .inputValidator((d: { funnelId: string; sessionId: string; stepIndex: number; completed?: boolean }) => d)
  .handler(async ({ data }) => {
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
  .inputValidator(z.object({ funnelId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("funnels").delete().eq("id", data.funnelId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });