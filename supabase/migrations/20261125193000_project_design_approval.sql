/*
# Design approval while a project is Pending

The assigned designer can upload finalized designs only while the project
is pending. The homeowner approves the submission or asks for changes.
The designer cannot set the approved status.
*/

CREATE OR REPLACE FUNCTION public.designer_can_upload_project_design(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    JOIN public.designers d ON d.id = c.assigned_designer_id
    WHERE c.id = p_project_id
      AND d.user_id = auth.uid()
      AND c.assignment_status = 'pending'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_project_design(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customers c
    LEFT JOIN public.designers d ON d.id = c.assigned_designer_id
    WHERE c.id = p_project_id
      AND (c.user_id = auth.uid() OR d.user_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.designer_can_upload_project_design(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_project_design(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.designer_can_upload_project_design(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_project_design(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_design_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  designer_id uuid NOT NULL REFERENCES public.designers(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 2 AND 120),
  note text,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'changes_requested')),
  customer_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS project_design_one_open_submission
  ON public.project_design_submissions (project_id)
  WHERE status = 'pending_approval';

CREATE TABLE IF NOT EXISTS public.project_design_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.project_design_submissions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_design_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_design_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members read design submissions" ON public.project_design_submissions;
CREATE POLICY "Project members read design submissions"
  ON public.project_design_submissions FOR SELECT TO authenticated
  USING (public.can_read_project_design(project_id));

DROP POLICY IF EXISTS "Assigned designer submits a pending design" ON public.project_design_submissions;
CREATE POLICY "Assigned designer submits a pending design"
  ON public.project_design_submissions FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending_approval'
    AND decided_at IS NULL
    AND public.designer_can_upload_project_design(project_id)
    AND designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Homeowner decides a pending design" ON public.project_design_submissions;
CREATE POLICY "Homeowner decides a pending design"
  ON public.project_design_submissions FOR UPDATE TO authenticated
  USING (
    status = 'pending_approval'
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = project_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('approved', 'changes_requested')
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = project_id AND c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.stamp_design_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'changes_requested' AND char_length(btrim(COALESCE(NEW.customer_note, ''))) < 3 THEN
    RAISE EXCEPTION 'A note is required when asking for design changes';
  END IF;
  IF NEW.status IN ('approved', 'changes_requested') AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.decided_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_design_decision ON public.project_design_submissions;
CREATE TRIGGER stamp_design_decision
  BEFORE UPDATE OF status ON public.project_design_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_design_decision();

DROP POLICY IF EXISTS "Project members read design files" ON public.project_design_files;
CREATE POLICY "Project members read design files"
  ON public.project_design_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_design_submissions s
      WHERE s.id = submission_id AND public.can_read_project_design(s.project_id)
    )
  );

DROP POLICY IF EXISTS "Designer adds files to an open design" ON public.project_design_files;
CREATE POLICY "Designer adds files to an open design"
  ON public.project_design_files FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_design_submissions s
      WHERE s.id = submission_id
        AND s.status = 'pending_approval'
        AND public.designer_can_upload_project_design(s.project_id)
        AND s.designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Designer removes an open design" ON public.project_design_submissions;
CREATE POLICY "Designer removes an open design"
  ON public.project_design_submissions FOR DELETE TO authenticated
  USING (
    status = 'pending_approval'
    AND designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Designer removes files from an open design" ON public.project_design_files;
CREATE POLICY "Designer removes files from an open design"
  ON public.project_design_files FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_design_submissions s
      WHERE s.id = submission_id
        AND s.status = 'pending_approval'
        AND s.designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
    )
  );

GRANT SELECT, INSERT, DELETE ON public.project_design_submissions TO authenticated;
GRANT UPDATE (status, customer_note, decided_at) ON public.project_design_submissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_design_files TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-designs',
  'project-designs',
  false,
  26214400,
  ARRAY['image/jpeg','image/jpg','image/png','application/pdf','application/zip','application/x-zip-compressed']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "project_designs_designer_insert" ON storage.objects;
CREATE POLICY "project_designs_designer_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
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

DROP POLICY IF EXISTS "project_designs_designer_delete" ON storage.objects;
CREATE POLICY "project_designs_designer_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'project-designs'
  AND EXISTS (
    SELECT 1 FROM public.project_design_submissions s
    WHERE s.id::text = (storage.foldername(name))[2]
      AND s.project_id::text = (storage.foldername(name))[1]
      AND s.status = 'pending_approval'
      AND s.designer_id IN (SELECT id FROM public.designers WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "project_designs_select" ON storage.objects;
CREATE POLICY "project_designs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'project-designs'
  AND public.can_read_project_design(((storage.foldername(name))[1])::uuid)
);
