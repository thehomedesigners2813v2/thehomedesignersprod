/*
# Let a designer remove a design submission that failed to upload
*/

DROP POLICY IF EXISTS "Designer removes an open design submission" ON public.project_design_submissions;
CREATE POLICY "Designer removes an open design submission"
  ON public.project_design_submissions FOR DELETE TO authenticated
  USING (
    status = 'pending_approval'
    AND designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
  );

GRANT DELETE ON public.project_design_submissions TO authenticated;

DROP POLICY IF EXISTS "Designer removes files of an open design" ON public.project_design_files;
CREATE POLICY "Designer removes files of an open design"
  ON public.project_design_files FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_design_submissions s
      WHERE s.id = submission_id
        AND s.status = 'pending_approval'
        AND s.designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
    )
  );

GRANT DELETE ON public.project_design_files TO authenticated;

DROP POLICY IF EXISTS "project_designs_designer_delete" ON storage.objects;
CREATE POLICY "project_designs_designer_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'project-designs'
  AND public.designer_can_upload_project_design(((storage.foldername(name))[1])::uuid)
  AND EXISTS (
    SELECT 1 FROM public.project_design_submissions s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.project_id::text = (storage.foldername(name))[1]
      AND s.status = 'pending_approval'
      AND s.designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
