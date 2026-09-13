DROP TRIGGER IF EXISTS grant_platform_creator_role_trigger ON auth.users;

CREATE OR REPLACE FUNCTION public.grant_platform_creator_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = NEW.id;
  IF _email = 'victoriayangchihhan@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'platform_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grant_platform_creator_role_trigger ON public.profiles;
CREATE TRIGGER grant_platform_creator_role_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_platform_creator_role();
