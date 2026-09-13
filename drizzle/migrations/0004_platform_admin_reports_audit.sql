-- Platform-level roles (never stored on profiles)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('platform_admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users read their own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'));

-- Suspension flag on profiles (nullable, additive)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason text;

-- Content reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports (status, created_at DESC);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT UPDATE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can report content"
ON public.content_reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporters and platform admins read reports"
ON public.content_reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins update reports"
ON public.content_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins write audit log"
ON public.admin_audit_log FOR INSERT TO authenticated
WITH CHECK (admin_id = auth.uid() AND public.has_role(auth.uid(), 'platform_admin'));

-- Platform admin read access for moderation metrics
CREATE POLICY "Platform admins read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins update profiles for suspension"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins read all families"
ON public.families FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins read all family members"
ON public.family_members FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins read all posts"
ON public.posts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins delete posts"
ON public.posts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins read all photos"
ON public.photos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

CREATE POLICY "Platform admins delete photos"
ON public.photos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

-- Grant the platform creator their role now and on future signup
CREATE OR REPLACE FUNCTION public.grant_platform_creator_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'victoriayangchihhan@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'platform_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_platform_creator_role_trigger ON auth.users;
CREATE TRIGGER grant_platform_creator_role_trigger
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_platform_creator_role();

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'platform_admin' FROM auth.users
WHERE lower(email) = 'victoriayangchihhan@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
