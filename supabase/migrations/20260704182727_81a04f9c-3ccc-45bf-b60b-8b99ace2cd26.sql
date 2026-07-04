CREATE TABLE public.whatsapp_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL UNIQUE REFERENCES public.funnels(id) ON DELETE CASCADE,
  phone_numbers TEXT[] NOT NULL DEFAULT '{}',
  group_jid TEXT,
  invite_link TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'provisioning', 'active', 'action_needed', 'canceled', 'failed')),
  evolution_instance TEXT NOT NULL DEFAULT 'disparo-alaorpedro-mqtsbvi0',
  stripe_subscription_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_alerts_stripe_subscription_id ON public.whatsapp_alerts(stripe_subscription_id);

GRANT SELECT ON public.whatsapp_alerts TO authenticated;
GRANT ALL ON public.whatsapp_alerts TO service_role;

ALTER TABLE public.whatsapp_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own whatsapp alerts" ON public.whatsapp_alerts FOR SELECT USING (
  funnel_id IN (SELECT id FROM public.funnels WHERE owner_id = auth.uid())
);

CREATE TRIGGER trg_whatsapp_alerts_touch_updated_at
  BEFORE UPDATE ON public.whatsapp_alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();