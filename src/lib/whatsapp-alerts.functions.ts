import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addParticipants, createGroup, getInviteLink, sendGroupMessage, setAnnounceOnly } from "@/lib/evolution.server";

export const WHATSAPP_ALERTS_PRICE_ID = "whatsapp_alerts_monthly";
const MAX_NUMBERS = 5;

export type WhatsappAlertRow = {
  funnel_id: string;
  phone_numbers: string[];
  group_jid: string | null;
  invite_link: string | null;
  status: "pending_payment" | "provisioning" | "active" | "action_needed" | "canceled" | "failed";
  last_error: string | null;
};

function normalizePhoneNumbers(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error("Lista de números inválida");
  const digits = raw
    .map((v) => String(v ?? "").replace(/\D/g, ""))
    .filter((v) => v.length > 0);
  if (!digits.length) throw new Error("Cadastre ao menos um número de WhatsApp");
  if (digits.length > MAX_NUMBERS) throw new Error(`Máximo de ${MAX_NUMBERS} números por funil`);
  for (const d of digits) {
    if (d.length < 10 || d.length > 15) throw new Error(`Número inválido: ${d}`);
  }
  return Array.from(new Set(digits));
}

export const getWhatsappAlert = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { funnelId: string }) => {
    if (!d?.funnelId) throw new Error("funnelId obrigatório");
    return d;
  })
  .handler(async ({ data, context }): Promise<{ alert: WhatsappAlertRow | null }> => {
    // RLS ("owners read own whatsapp alerts") scopes this to the caller's own funnels.
    const { data: alert } = await context.supabase
      .from("whatsapp_alerts")
      .select("funnel_id, phone_numbers, group_jid, invite_link, status, last_error")
      .eq("funnel_id", data.funnelId)
      .maybeSingle();
    return { alert: (alert as WhatsappAlertRow) ?? null };
  });

export const saveWhatsappAlertNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { funnelId: string; phoneNumbers: string[] }) => {
    if (!d?.funnelId) throw new Error("funnelId obrigatório");
    return { funnelId: d.funnelId, phoneNumbers: normalizePhoneNumbers(d.phoneNumbers) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; status: string } | { error: string }> => {
    const { data: funnel } = await supabaseAdmin
      .from("funnels")
      .select("id")
      .eq("id", data.funnelId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!funnel) return { error: "Funil não encontrado para este usuário." };

    const { data: existing } = await supabaseAdmin
      .from("whatsapp_alerts")
      .select("phone_numbers, status")
      .eq("funnel_id", data.funnelId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin.from("whatsapp_alerts").insert({
        funnel_id: data.funnelId,
        phone_numbers: data.phoneNumbers,
        status: "pending_payment",
      });
      if (error) return { error: error.message };
      return { ok: true, status: "pending_payment" };
    }

    const numbersChanged = JSON.stringify([...(existing.phone_numbers ?? [])].sort())
      !== JSON.stringify([...data.phoneNumbers].sort());

    // A canceled/failed alert is about to be re-purchased: reset to pending_payment so the
    // next paid webhook event knows to (re)provision it, even if the numbers didn't change.
    if (existing.status === "canceled" || existing.status === "failed") {
      const { error } = await supabaseAdmin.from("whatsapp_alerts").update({
        phone_numbers: data.phoneNumbers,
        status: "pending_payment",
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("funnel_id", data.funnelId);
      if (error) return { error: error.message };
      return { ok: true, status: "pending_payment" };
    }

    if (!numbersChanged) return { ok: true, status: existing.status };

    if (existing.status === "active" || existing.status === "action_needed" || existing.status === "provisioning") {
      const { error } = await supabaseAdmin.from("whatsapp_alerts").update({
        phone_numbers: data.phoneNumbers,
        status: "provisioning",
        updated_at: new Date().toISOString(),
      }).eq("funnel_id", data.funnelId);
      if (error) return { error: error.message };
      await provisionWhatsappAlert(data.funnelId);
      return { ok: true, status: "provisioning" };
    }

    const { error } = await supabaseAdmin.from("whatsapp_alerts").update({
      phone_numbers: data.phoneNumbers,
      updated_at: new Date().toISOString(),
    }).eq("funnel_id", data.funnelId);
    if (error) return { error: error.message };
    return { ok: true, status: existing.status };
  });

// Called after payment confirmation (webhook) or when a subscriber updates their numbers.
// Never throws — failures are recorded on the row as status=action_needed for the owner to see.
export async function provisionWhatsappAlert(funnelId: string): Promise<void> {
  const { data: alert } = await supabaseAdmin
    .from("whatsapp_alerts")
    .select("group_jid, phone_numbers, evolution_instance")
    .eq("funnel_id", funnelId)
    .maybeSingle();
  if (!alert || !alert.phone_numbers?.length) return;

  const { data: funnel } = await supabaseAdmin.from("funnels").select("name").eq("id", funnelId).maybeSingle();
  const instance = alert.evolution_instance;

  try {
    let groupJid = alert.group_jid;
    if (!groupJid) {
      const created = await createGroup({
        subject: `Leads – ${funnel?.name ?? "Funil"}`.slice(0, 100),
        participants: alert.phone_numbers,
        instance,
      });
      groupJid = created.groupJid;
      await setAnnounceOnly({ groupJid, announce: true, instance }).catch((e) =>
        console.error("[whatsapp-alerts] announce-only failed", e),
      );
    } else {
      await addParticipants({ groupJid, participants: alert.phone_numbers, instance });
    }

    let inviteLink: string | null = null;
    try {
      inviteLink = await getInviteLink({ groupJid, instance });
    } catch (e) {
      console.warn("[whatsapp-alerts] invite link fetch failed", e);
    }

    await supabaseAdmin.from("whatsapp_alerts").update({
      group_jid: groupJid,
      invite_link: inviteLink,
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("funnel_id", funnelId);
  } catch (error: any) {
    console.error("[whatsapp-alerts] provisioning failed", error);
    await supabaseAdmin.from("whatsapp_alerts").update({
      status: "action_needed",
      last_error: String(error?.message ?? error).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("funnel_id", funnelId);
  }
}

// Fire-and-forget lead notification, mirrors postToSheetsWebhook's error-swallowing behavior.
export async function postToWhatsAppAlert(
  funnelId: string,
  payload: { name?: string | null; phone?: string | null; email?: string | null },
): Promise<void> {
  try {
    const { data: alert } = await supabaseAdmin
      .from("whatsapp_alerts")
      .select("group_jid, status, evolution_instance")
      .eq("funnel_id", funnelId)
      .maybeSingle();
    // "action_needed" still means a real, working group — it only flags that not every
    // registered number auto-joined. Whoever did join should still get the alert, so we
    // send whenever the group exists; only pending/provisioning/canceled/failed skip.
    if (!alert || !alert.group_jid || !["active", "action_needed"].includes(alert.status)) return;

    const lines = [
      "🔔 *Novo lead recebido*",
      payload.name ? `Nome: ${payload.name}` : null,
      payload.phone ? `Telefone: ${payload.phone}` : null,
      payload.email ? `Email: ${payload.email}` : null,
    ].filter(Boolean) as string[];

    await sendGroupMessage({ groupJid: alert.group_jid, text: lines.join("\n"), instance: alert.evolution_instance });
  } catch (error) {
    console.error("[whatsapp-alerts] send failed", error);
  }
}
