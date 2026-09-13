DROP POLICY IF EXISTS "photos update" ON public.photos;
CREATE POLICY "photos update" ON public.photos
FOR UPDATE TO authenticated
USING ((uploader_id = auth.uid()) OR public.is_family_admin(family_id))
WITH CHECK ((uploader_id = auth.uid()) OR public.is_family_admin(family_id));