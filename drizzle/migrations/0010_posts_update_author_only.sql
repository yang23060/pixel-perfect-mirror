DROP POLICY "posts update" ON public.posts;
CREATE POLICY "posts update" ON public.posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());