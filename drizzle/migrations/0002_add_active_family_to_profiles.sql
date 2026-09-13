ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_family_id uuid REFERENCES public.families(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_active_family_idx ON public.profiles(active_family_id);