
DO $$ BEGIN
  CREATE TYPE public.crm_member_role AS ENUM ('admin', 'agent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===== crm_pipelines =====
CREATE TABLE public.crm_pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_pipelines_owner ON public.crm_pipelines(owner_id);
CREATE UNIQUE INDEX uniq_crm_pipelines_owner_default
  ON public.crm_pipelines(owner_id) WHERE is_default = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipelines TO authenticated;
GRANT ALL ON public.crm_pipelines TO service_role;
ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own pipelines"
  ON public.crm_pipelines FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_crm_pipelines_updated_at
  BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== crm_stages =====
CREATE TABLE public.crm_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT 'slate',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_stages_pipeline ON public.crm_stages(pipeline_id, "order");
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_stages TO authenticated;
GRANT ALL ON public.crm_stages TO service_role;
ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own stages"
  ON public.crm_stages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_pipelines p WHERE p.id = pipeline_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_pipelines p WHERE p.id = pipeline_id AND p.owner_id = auth.uid()));

-- ===== crm_members (created BEFORE the helper function that references it) =====
CREATE TABLE public.crm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.crm_member_role NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, user_id)
);
CREATE INDEX idx_crm_members_owner ON public.crm_members(owner_id);
CREATE INDEX idx_crm_members_user ON public.crm_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_members TO authenticated;
GRANT ALL ON public.crm_members TO service_role;
ALTER TABLE public.crm_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own members"
  ON public.crm_members FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "members read own membership"
  ON public.crm_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Helper (now that crm_members exists)
CREATE OR REPLACE FUNCTION public.is_crm_member(_owner_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.crm_members m WHERE m.owner_id = _owner_id AND m.user_id = _user_id);
$$;

-- ===== crm_lead_cards =====
CREATE TABLE public.crm_lead_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  pipeline_id uuid NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.crm_stages(id) ON DELETE RESTRICT,
  assignee_id uuid,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  moved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_lead_cards_owner ON public.crm_lead_cards(owner_id);
CREATE INDEX idx_crm_lead_cards_stage ON public.crm_lead_cards(stage_id, position);
CREATE INDEX idx_crm_lead_cards_assignee ON public.crm_lead_cards(assignee_id);
CREATE UNIQUE INDEX uniq_crm_lead_cards_lead_pipeline ON public.crm_lead_cards(lead_id, pipeline_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_lead_cards TO authenticated;
GRANT ALL ON public.crm_lead_cards TO service_role;
ALTER TABLE public.crm_lead_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners full access lead_cards"
  ON public.crm_lead_cards FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "members read assigned or unassigned lead_cards"
  ON public.crm_lead_cards FOR SELECT TO authenticated
  USING (public.is_crm_member(owner_id, auth.uid())
         AND (assignee_id IS NULL OR assignee_id = auth.uid()));
CREATE POLICY "members update assigned lead_cards"
  ON public.crm_lead_cards FOR UPDATE TO authenticated
  USING (public.is_crm_member(owner_id, auth.uid())
         AND (assignee_id IS NULL OR assignee_id = auth.uid()))
  WITH CHECK (public.is_crm_member(owner_id, auth.uid())
              AND (assignee_id IS NULL OR assignee_id = auth.uid()));
CREATE TRIGGER trg_crm_lead_cards_updated_at
  BEFORE UPDATE ON public.crm_lead_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== crm_notes =====
CREATE TABLE public.crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_card_id uuid NOT NULL REFERENCES public.crm_lead_cards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_notes_card ON public.crm_notes(lead_card_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_notes TO authenticated;
GRANT ALL ON public.crm_notes TO service_role;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read notes when can read card"
  ON public.crm_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_lead_cards c WHERE c.id = lead_card_id));
CREATE POLICY "insert own notes on accessible cards"
  ON public.crm_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id
              AND EXISTS (SELECT 1 FROM public.crm_lead_cards c WHERE c.id = lead_card_id));
CREATE POLICY "authors delete own notes"
  ON public.crm_notes FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- ===== crm_events =====
CREATE TABLE public.crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_card_id uuid NOT NULL REFERENCES public.crm_lead_cards(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_events_card ON public.crm_events(lead_card_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_events TO authenticated;
GRANT ALL ON public.crm_events TO service_role;
ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read events when can read card"
  ON public.crm_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.crm_lead_cards c WHERE c.id = lead_card_id));

-- ===== Auto-create card when a new lead arrives via funnels =====
CREATE OR REPLACE FUNCTION public.crm_create_card_on_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid; v_pipeline uuid; v_stage uuid;
BEGIN
  SELECT f.owner_id INTO v_owner FROM public.funnels f WHERE f.id = NEW.funnel_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_pipeline FROM public.crm_pipelines
    WHERE owner_id = v_owner AND is_default = true LIMIT 1;
  IF v_pipeline IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_stage FROM public.crm_stages
    WHERE pipeline_id = v_pipeline ORDER BY "order" ASC LIMIT 1;
  IF v_stage IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.crm_lead_cards (owner_id, lead_id, pipeline_id, stage_id, position)
  VALUES (v_owner, NEW.id, v_pipeline, v_stage, 0)
  ON CONFLICT (lead_id, pipeline_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_create_crm_card
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.crm_create_card_on_lead();
