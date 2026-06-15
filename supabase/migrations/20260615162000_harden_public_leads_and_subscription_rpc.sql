-- Public funnels are rendered and submitted through server functions.
-- Do not allow browser clients to write leads/responses directly with the anon key,
-- otherwise they can bypass rate limits and plan quotas enforced in funnels.functions.ts.
DROP POLICY IF EXISTS "public insert responses for published funnels" ON public.funnel_responses;
DROP POLICY IF EXISTS "public insert leads for published funnels" ON public.leads;

REVOKE INSERT ON public.funnel_responses FROM anon, authenticated;
REVOKE INSERT ON public.leads FROM anon, authenticated;

-- Keep the helper callable by authenticated users, but only for their own user id.
CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text DEFAULT 'sandbox'::text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    LEFT JOIN auth.users u ON u.id = user_uuid
    WHERE auth.uid() = user_uuid
      AND s.environment = check_env
      AND (
        s.user_id = user_uuid
        OR (s.customer_email IS NOT NULL AND u.email IS NOT NULL AND lower(s.customer_email) = lower(u.email))
      )
      AND (
        (s.status IN ('active', 'trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO authenticated;
