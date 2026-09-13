-- Stage 2: moment posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location text;

CREATE TABLE IF NOT EXISTS public.post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  duration_seconds integer,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT ALL ON public.post_media TO service_role;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_media readable by family" ON public.post_media FOR SELECT TO authenticated
  USING (public.is_family_member(family_id));
CREATE POLICY "post_media insert by family" ON public.post_media FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(family_id) AND uploader_id = auth.uid());
CREATE POLICY "post_media update own" ON public.post_media FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_family_admin(family_id));
CREATE POLICY "post_media delete own" ON public.post_media FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_family_admin(family_id));
CREATE INDEX IF NOT EXISTS post_media_post_idx ON public.post_media(post_id, position);

-- Backfill existing post images into post_media
INSERT INTO public.post_media (post_id, family_id, uploader_id, url, kind, position, created_at)
SELECT pi.post_id, pi.family_id, p.author_id, pi.url, 'image', pi.position, pi.created_at
FROM public.post_images pi
JOIN public.posts p ON p.id = pi.post_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.post_media pm WHERE pm.post_id = pi.post_id AND pm.url = pi.url
);

-- Stage 3: photo-only stories
CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories readable by family" ON public.stories FOR SELECT TO authenticated
  USING (public.is_family_member(family_id));
CREATE POLICY "stories insert own" ON public.stories FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(family_id) AND user_id = auth.uid());
CREATE POLICY "stories delete own" ON public.stories FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_family_admin(family_id));
CREATE INDEX IF NOT EXISTS stories_family_idx ON public.stories(family_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "story_views readable by family" ON public.story_views FOR SELECT TO authenticated
  USING (public.is_family_member(family_id));
CREATE POLICY "story_views insert own" ON public.story_views FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(family_id) AND user_id = auth.uid());
CREATE POLICY "story_views delete own" ON public.story_views FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Stage 4: chat photo attachments
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'image',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments readable by family" ON public.message_attachments FOR SELECT TO authenticated
  USING (public.is_family_member(family_id));
CREATE POLICY "attachments insert by family" ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(family_id));
CREATE POLICY "attachments delete by sender" ON public.message_attachments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
    OR public.is_family_admin(family_id));
CREATE INDEX IF NOT EXISTS message_attachments_msg_idx ON public.message_attachments(message_id, position);

-- Stage 5: albums support videos
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image';
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
