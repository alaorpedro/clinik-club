
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'partial',
  ADD COLUMN IF NOT EXISTS last_step_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS leads_funnel_session_uidx
  ON public.leads (funnel_id, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_funnel_status_idx
  ON public.leads (funnel_id, status);

DROP TRIGGER IF EXISTS leads_touch_updated_at ON public.leads;
CREATE TRIGGER leads_touch_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
