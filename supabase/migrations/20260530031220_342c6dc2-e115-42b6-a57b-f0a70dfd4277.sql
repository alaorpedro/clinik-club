CREATE INDEX IF NOT EXISTS idx_leads_funnel_created ON public.leads (funnel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_lead_cards_pipeline_status_pos ON public.crm_lead_cards (pipeline_id, status, position);
CREATE INDEX IF NOT EXISTS idx_public_action_log_action_session_created ON public.public_action_log (action, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_action_log_action_ip_created ON public.public_action_log (action, ip, created_at DESC);