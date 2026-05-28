-- Fix: crm_notes INSERT must verify card ownership/membership
DROP POLICY IF EXISTS "insert own notes on accessible cards" ON public.crm_notes;
CREATE POLICY "insert own notes on accessible cards"
  ON public.crm_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.crm_lead_cards c
      WHERE c.id = crm_notes.lead_card_id
        AND (
          c.owner_id = auth.uid()
          OR public.is_crm_member(c.owner_id, auth.uid())
        )
    )
  );

-- Fix: crm_notes SELECT must also be scoped to owner/member
DROP POLICY IF EXISTS "read notes when can read card" ON public.crm_notes;
CREATE POLICY "read notes when can read card"
  ON public.crm_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_lead_cards c
      WHERE c.id = crm_notes.lead_card_id
        AND (
          c.owner_id = auth.uid()
          OR public.is_crm_member(c.owner_id, auth.uid())
        )
    )
  );

-- Fix: crm_events SELECT must be scoped to owner/member
DROP POLICY IF EXISTS "read events when can read card" ON public.crm_events;
CREATE POLICY "read events when can read card"
  ON public.crm_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_lead_cards c
      WHERE c.id = crm_events.lead_card_id
        AND (
          c.owner_id = auth.uid()
          OR public.is_crm_member(c.owner_id, auth.uid())
        )
    )
  );

-- Fix: crm_stages — add explicit SELECT for owners and members
CREATE POLICY "members read stages of accessible pipelines"
  ON public.crm_stages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_pipelines p
      WHERE p.id = crm_stages.pipeline_id
        AND (
          p.owner_id = auth.uid()
          OR public.is_crm_member(p.owner_id, auth.uid())
        )
    )
  );

-- Fix: crm_pipelines — allow members to read pipelines of their owner
CREATE POLICY "members read pipelines of their owner"
  ON public.crm_pipelines
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_crm_member(owner_id, auth.uid())
  );