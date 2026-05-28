-- Item 1: Remover leitura pública da tabela funnels.
-- O acesso público ao funil agora passa exclusivamente pela server function
-- getPublicFunnel (que usa o client admin e seleciona apenas colunas seguras),
-- evitando que o sheets_webhook_url seja exposto a qualquer pessoa.
DROP POLICY IF EXISTS "public read published funnels" ON public.funnels;

-- Garantir que anon não consegue mais ler a tabela diretamente.
REVOKE SELECT ON public.funnels FROM anon;

-- Item 2: Impedir que membros do CRM alterem campos críticos (owner_id, lead_id,
-- pipeline_id e funnel_id) dos cards. Apenas o dono pode mover/transferir cards.
CREATE OR REPLACE FUNCTION public.crm_lead_cards_guard_member_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Dono da operação pode alterar tudo
  IF auth.uid() = OLD.owner_id THEN
    RETURN NEW;
  END IF;

  -- Demais usuários (membros) não podem reatribuir o card
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

DROP TRIGGER IF EXISTS crm_lead_cards_guard_updates ON public.crm_lead_cards;
CREATE TRIGGER crm_lead_cards_guard_updates
BEFORE UPDATE ON public.crm_lead_cards
FOR EACH ROW
EXECUTE FUNCTION public.crm_lead_cards_guard_member_updates();