import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

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

export type CouponRow = {
  promotion_code_id: string;
  code: string;
  active: boolean;
  max_redemptions: number | null;
  times_redeemed: number;
  expires_at: number | null;
  coupon_id: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
  created: number;
};

type ListResult = { coupons: CouponRow[] } | { error: string };
type MutationResult = { ok: true } | { error: string };
type CreateResult = { ok: true; code: string } | { error: string };

export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<ListResult> => {
    await ensureAdmin(context.userId);
    try {
      const stripe = createStripeClient(data.environment);
      const codes = await stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
      const coupons: CouponRow[] = codes.data.flatMap((pc) => {
        const c = pc.promotion.coupon;
        if (!c || typeof c === "string") return [];
        return {
          promotion_code_id: pc.id,
          code: pc.code,
          active: pc.active,
          max_redemptions: pc.max_redemptions ?? null,
          times_redeemed: pc.times_redeemed,
          expires_at: pc.expires_at ?? null,
          coupon_id: c.id,
          percent_off: c.percent_off ?? null,
          amount_off: c.amount_off ?? null,
          currency: c.currency ?? null,
          duration: c.duration,
          duration_in_months: c.duration_in_months ?? null,
          created: pc.created,
        };
      });
      return { coupons };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    environment: StripeEnv;
    code: string;
    discountType: "percent" | "amount";
    percentOff?: number;
    amountOffCents?: number;
    currency?: string;
    duration: "once" | "forever" | "repeating";
    durationInMonths?: number;
    maxRedemptions?: number;
    expiresAt?: number;
  }) => {
    if (!/^[A-Z0-9_-]{3,40}$/.test(data.code)) {
      throw new Error("Código deve ter 3-40 caracteres (A-Z, 0-9, _ ou -)");
    }
    if (data.discountType === "percent") {
      if (!data.percentOff || data.percentOff < 1 || data.percentOff > 100) {
        throw new Error("Percentual deve estar entre 1 e 100");
      }
    } else {
      if (!data.amountOffCents || data.amountOffCents < 1) {
        throw new Error("Valor inválido");
      }
    }
    if (data.duration === "repeating" && (!data.durationInMonths || data.durationInMonths < 1)) {
      throw new Error("Informe o número de meses para duração 'repeating'");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<CreateResult> => {
    await ensureAdmin(context.userId);
    try {
      const stripe = createStripeClient(data.environment);
      const coupon = await stripe.coupons.create({
        duration: data.duration,
        ...(data.duration === "repeating" && { duration_in_months: data.durationInMonths }),
        ...(data.discountType === "percent"
          ? { percent_off: data.percentOff }
          : { amount_off: data.amountOffCents, currency: data.currency ?? "brl" }),
      });
      const pc = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
        code: data.code,
        ...(data.maxRedemptions && { max_redemptions: data.maxRedemptions }),
        ...(data.expiresAt && { expires_at: data.expiresAt }),
      });
      return { ok: true, code: pc.code };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const setCouponActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: StripeEnv; promotionCodeId: string; active: boolean }) => {
    if (!/^promo_[a-zA-Z0-9]+$/.test(data.promotionCodeId)) throw new Error("ID inválido");
    return data;
  })
  .handler(async ({ data, context }): Promise<MutationResult> => {
    await ensureAdmin(context.userId);
    try {
      const stripe = createStripeClient(data.environment);
      await stripe.promotionCodes.update(data.promotionCodeId, { active: data.active });
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });