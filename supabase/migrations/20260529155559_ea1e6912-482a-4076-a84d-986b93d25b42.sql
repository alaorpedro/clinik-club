
-- 1) handle_new_user: tornar resiliente a falhas (não abortar signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, name, avatar_url)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.raw_user_meta_data->>'avatar_url'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile insert failed for %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    UPDATE public.subscriptions
    SET user_id = NEW.id
    WHERE user_id IS NULL
      AND lower(customer_email) = lower(NEW.email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user subscription link failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- 2) Idempotência de webhooks Stripe
CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  event_id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'stripe',
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.processed_webhook_events TO service_role;
ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role acessa.

-- 3) Rate limiting básico de ações públicas
CREATE TABLE IF NOT EXISTS public.public_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  session_id text,
  ip text,
  funnel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pal_action_session_created ON public.public_action_log (action, session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_action_ip_created ON public.public_action_log (action, ip, created_at DESC);
GRANT ALL ON public.public_action_log TO service_role;
ALTER TABLE public.public_action_log ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role acessa.
