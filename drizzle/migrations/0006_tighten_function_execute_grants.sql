ALTER FUNCTION public.touch_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.can_read_chat(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_family_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shares_family_with(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_family(text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_family_with_code(text, text) FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.grant_platform_creator_role() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;

GRANT EXECUTE ON FUNCTION public.can_read_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_family_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_family(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family_with_code(text, text) TO authenticated;
