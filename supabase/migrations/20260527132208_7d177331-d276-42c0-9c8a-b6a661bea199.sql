ALTER TABLE public.subscriptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS customer_email text;
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email ON public.subscriptions(customer_email);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Link any pending anonymous subscriptions purchased with this email
  UPDATE public.subscriptions
  SET user_id = NEW.id
  WHERE user_id IS NULL
    AND lower(customer_email) = lower(NEW.email);

  RETURN NEW;
END;
$function$;