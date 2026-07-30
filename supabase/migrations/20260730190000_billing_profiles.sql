-- Per-customer billing data for manual NF (nota fiscal) issuance.
-- Prefilled in the admin UI from Stripe (boleto tax_id, charge billing
-- address) and completed/overridden manually; keyed by Stripe customer.
-- Admin-only feature: no client policies — all reads/writes go through
-- server functions using the service role.
CREATE TABLE public.billing_profiles (
  stripe_customer_id TEXT PRIMARY KEY,
  legal_name TEXT,
  tax_id TEXT,
  address_line TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  email TEXT,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.billing_profiles TO service_role;
