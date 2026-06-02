-- Hardening SECURITY DEFINER functions
-- 1. Revoke default EXECUTE from PUBLIC on all functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- 2. Explicitly revoke execute on sensitive functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.crm_create_card_on_lead() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.crm_lead_cards_guard_member_updates() FROM PUBLIC, authenticated, anon;

-- 3. Grant execute back to roles for RLS helper functions (with correct signatures)
GRANT EXECUTE ON FUNCTION public.is_crm_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_plan(uuid, text) TO authenticated;

-- 4. Set search_path to public for SECURITY DEFINER functions to prevent hijacking
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.is_crm_member(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.crm_create_card_on_lead() SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.has_active_subscription(uuid, text) SET search_path = public;
ALTER FUNCTION public.get_active_plan(uuid, text) SET search_path = public;

-- 5. Add RLS policies for tables without them (to satisfy linter)
-- These tables are intended for internal/admin use via service_role only.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'processed_webhook_events' AND policyname = 'Internal use only') THEN
        CREATE POLICY "Internal use only" ON public.processed_webhook_events 
        FOR ALL TO service_role USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_action_log' AND policyname = 'Internal use only') THEN
        CREATE POLICY "Internal use only" ON public.public_action_log 
        FOR ALL TO service_role USING (true);
    END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_action_log ENABLE ROW LEVEL SECURITY;
