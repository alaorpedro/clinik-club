-- Let customers own their billing data: billing_profiles gains user_id and
-- a surrogate PK so a row can exist before the user has a Stripe customer.
-- Access still goes exclusively through server functions (service role);
-- the customer-facing functions scope by the authenticated user_id.
ALTER TABLE public.billing_profiles DROP CONSTRAINT billing_profiles_pkey;
ALTER TABLE public.billing_profiles ADD COLUMN id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.billing_profiles ADD PRIMARY KEY (id);
ALTER TABLE public.billing_profiles ALTER COLUMN stripe_customer_id DROP NOT NULL;
ALTER TABLE public.billing_profiles ADD CONSTRAINT billing_profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
ALTER TABLE public.billing_profiles ADD COLUMN user_id UUID;
ALTER TABLE public.billing_profiles ADD CONSTRAINT billing_profiles_user_id_key UNIQUE (user_id);

UPDATE public.billing_profiles bp
SET user_id = s.user_id
FROM public.subscriptions s
WHERE s.stripe_customer_id = bp.stripe_customer_id
  AND bp.user_id IS NULL
  AND s.user_id IS NOT NULL;
