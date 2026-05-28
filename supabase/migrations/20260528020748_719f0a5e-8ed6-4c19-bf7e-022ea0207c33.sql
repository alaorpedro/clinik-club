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
    WHERE s.environment = check_env
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

UPDATE public.subscriptions s
SET user_id = u.id
FROM auth.users u
WHERE s.customer_email IS NOT NULL
  AND lower(s.customer_email) = lower(u.email)
  AND s.user_id IS DISTINCT FROM u.id
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s2
    WHERE s2.user_id = u.id AND s2.environment = s.environment AND s2.status = 'active'
  );