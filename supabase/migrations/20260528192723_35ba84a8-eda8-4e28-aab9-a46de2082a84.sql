CREATE OR REPLACE FUNCTION public.crm_lead_cards_guard_member_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Apenas o dono pode transferir cards';
  END IF;
  IF NEW.lead_id IS DISTINCT FROM OLD.lead_id THEN
    RAISE EXCEPTION 'Não é permitido trocar o lead vinculado';
  END IF;
  IF NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    RAISE EXCEPTION 'Apenas o dono pode mover cards entre pipelines';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_lead_cards_guard_member_updates() FROM anon, authenticated, public;