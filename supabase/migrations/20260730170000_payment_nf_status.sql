-- Manual NF (nota fiscal) tracking for confirmed Stripe payments.
-- One row per Stripe charge (ch_/py_) the admin marked; absence of a row = NF not issued.
-- Admin-only feature: no client policies — all reads/writes go through server
-- functions using the service role.
CREATE TABLE public.payment_nf_status (
  payment_id TEXT PRIMARY KEY,
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('live','sandbox')),
  nf_issued BOOLEAN NOT NULL DEFAULT false,
  nf_issued_at TIMESTAMPTZ,
  nf_issued_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_nf_status ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_nf_status TO service_role;
