import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPublicFunnel = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => {
    if (!d?.slug || typeof d.slug !== "string" || d.slug.length > 200) throw new Error("slug inválido");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: funnel, error } = await supabaseAdmin
      .from("funnels")
      .select("id, name, slug, status, theme, clinic_name, clinic_logo_url, gtm_id, meta_pixel_id")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!funnel) return { funnel: null, steps: [] as Array<{ id: string; type: string; config: any; order: number }> };
    const { data: steps } = await supabaseAdmin
      .from("funnel_steps")
      .select("id, type, config, order")
      .eq("funnel_id", funnel.id)
      .order("order", { ascending: true });
    return { funnel, steps: (steps ?? []) as Array<{ id: string; type: string; config: any; order: number }> };
  });

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d: { funnelId: string; answers: Record<string, unknown>; email?: string; name?: string; phone?: string; utm?: Record<string, unknown> }) => {
    if (!d?.funnelId) throw new Error("funnelId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("leads").insert({
      funnel_id: data.funnelId,
      email: data.email ?? null,
      name: data.name ?? null,
      phone: data.phone ?? null,
      answers: (data.answers ?? {}) as any,
      utm: (data.utm ?? {}) as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trackStep = createServerFn({ method: "POST" })
  .inputValidator((d: { funnelId: string; sessionId: string; stepIndex: number; completed?: boolean }) => d)
  .handler(async ({ data }) => {
    await supabaseAdmin.from("funnel_responses").insert({
      funnel_id: data.funnelId,
      session_id: data.sessionId,
      step_index: data.stepIndex,
      completed: !!data.completed,
    });
    return { ok: true };
  });