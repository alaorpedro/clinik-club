-- Revogar EXECUTE de anon nas funções SECURITY DEFINER
-- Essas funções só fazem sentido para usuários autenticados (checam auth.uid())
-- ou são chamadas via supabaseAdmin (service_role). Defesa em profundidade.

REVOKE EXECUTE ON FUNCTION public.get_active_plan(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_crm_member(uuid, uuid) FROM anon, public;

-- Garantir que authenticated mantém acesso (necessário para policies RLS avaliarem)
GRANT EXECUTE ON FUNCTION public.get_active_plan(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_crm_member(uuid, uuid) TO authenticated, service_role;