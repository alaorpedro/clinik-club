
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  subscription_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Funnels
CREATE TABLE public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own funnels" ON public.funnels FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Funnel steps
CREATE TABLE public.funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.funnels ON DELETE CASCADE,
  "order" INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own steps" ON public.funnel_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.owner_id = auth.uid())
);

-- Leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.funnels ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  phone TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  utm JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own leads" ON public.leads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.owner_id = auth.uid())
);

-- Funnel responses (analytics)
CREATE TABLE public.funnel_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID NOT NULL REFERENCES public.funnels ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  step_index INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funnel_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own responses" ON public.funnel_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.funnels f WHERE f.id = funnel_id AND f.owner_id = auth.uid())
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER funnels_touch BEFORE UPDATE ON public.funnels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
