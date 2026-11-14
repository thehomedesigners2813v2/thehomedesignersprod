ALTER TABLE public.designers
  ADD COLUMN IF NOT EXISTS intro_video_url text;

GRANT SELECT (intro_video_url) ON public.designers TO anon, authenticated;
GRANT UPDATE (intro_video_url) ON public.designers TO authenticated;

UPDATE storage.buckets
SET public = true
WHERE id = 'designer-intro-videos';

DROP POLICY IF EXISTS "designer_intro_videos_public_select" ON storage.objects;
CREATE POLICY "designer_intro_videos_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'designer-intro-videos');
