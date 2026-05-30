REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.get_active_plan(uuid, text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_crm_member(uuid, uuid) FROM authenticated, anon, public;