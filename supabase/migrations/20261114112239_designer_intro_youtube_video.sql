ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS intro_youtube_id text;

GRANT SELECT (intro_youtube_id) ON public.designers TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.preserve_designer_intro_youtube_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.intro_youtube_id := OLD.intro_youtube_id;
    ELSE
      NEW.intro_youtube_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS preserve_designer_intro_youtube_id ON public.designers;
CREATE TRIGGER preserve_designer_intro_youtube_id
  BEFORE INSERT OR UPDATE ON public.designers
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_designer_intro_youtube_id();

CREATE TABLE IF NOT EXISTS public.youtube_channel_connection (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  refresh_token text NOT NULL,
  channel_label text,
  connected_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.youtube_channel_connection ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.youtube_channel_connection FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'designer-intro-videos',
  'designer-intro-videos',
  false,
  31457280,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "designer_intro_videos_insert" ON storage.objects;
CREATE POLICY "designer_intro_videos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'designer-intro-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.designers d WHERE d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "designer_intro_videos_update" ON storage.objects;
CREATE POLICY "designer_intro_videos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'designer-intro-videos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'designer-intro-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "designer_intro_videos_delete" ON storage.objects;
CREATE POLICY "designer_intro_videos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'designer-intro-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "designer_intro_videos_select" ON storage.objects;
CREATE POLICY "designer_intro_videos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'designer-intro-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
