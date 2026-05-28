CREATE OR REPLACE FUNCTION public.get_active_plan(user_uuid uuid, check_env text DEFAULT 'sandbox'::text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.price_id
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
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;