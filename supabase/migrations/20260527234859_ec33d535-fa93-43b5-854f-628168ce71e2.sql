CREATE POLICY "public read published funnels"
ON public.funnels
FOR SELECT
TO anon, authenticated
USING (status = 'published');

CREATE POLICY "public read steps of published funnels"
ON public.funnel_steps
FOR SELECT
TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.funnels f
  WHERE f.id = funnel_steps.funnel_id AND f.status = 'published'
));

CREATE POLICY "public insert responses for published funnels"
ON public.funnel_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.funnels f
  WHERE f.id = funnel_responses.funnel_id AND f.status = 'published'
));

CREATE POLICY "public insert leads for published funnels"
ON public.leads
FOR INSERT
TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.funnels f
  WHERE f.id = leads.funnel_id AND f.status = 'published'
));

GRANT SELECT ON public.funnels TO anon;
GRANT SELECT ON public.funnel_steps TO anon;
GRANT INSERT ON public.funnel_responses TO anon;
GRANT INSERT ON public.leads TO anon;

DROP POLICY IF EXISTS "Public read funnel-media" ON storage.objects;