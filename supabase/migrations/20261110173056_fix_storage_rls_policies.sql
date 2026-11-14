-- Replace storage RLS with owner-scoped policies.
-- auth.uid() is uuid. storage.foldername() is text.
-- designers.user_id, customers.user_id, and admin_users.user_id are uuid.
-- Compare folders with auth.uid() and table columns with auth.uid().

-- Type-correct admin check used by payment-proofs.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- project-images: owner folder only, images, 5 MB, public read
UPDATE storage.buckets
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/gif','image/webp']
WHERE id = 'project-images';

DROP POLICY IF EXISTS "Users can upload project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view project images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view all images" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to project-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own project-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own project-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view project-images" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can upload to project-images" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

DROP POLICY IF EXISTS "project_images_insert" ON storage.objects;
CREATE POLICY "project_images_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-images' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "project_images_update" ON storage.objects;
CREATE POLICY "project_images_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-images' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'project-images' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "project_images_delete" ON storage.objects;
CREATE POLICY "project_images_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-images' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "project_images_select" ON storage.objects;
CREATE POLICY "project_images_select" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'project-images');

-- designer-profiles: drop the open v2 policies, then keep the owner folder
UPDATE storage.buckets
SET public = true, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp']
WHERE id = 'designer-profiles';

DROP POLICY IF EXISTS "designer_profiles_insert" ON storage.objects;
DROP POLICY IF EXISTS "designer_profiles_update" ON storage.objects;
DROP POLICY IF EXISTS "designer_profiles_delete" ON storage.objects;
DROP POLICY IF EXISTS "designer_profiles_select" ON storage.objects;
DROP POLICY IF EXISTS "Designers can upload own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Designers can update own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Designers can delete own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

DROP POLICY IF EXISTS "designer_profiles_insert" ON storage.objects;
CREATE POLICY "designer_profiles_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'designer-profiles'
  AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.designers d WHERE d.user_id = auth.uid())
);
DROP POLICY IF EXISTS "designer_profiles_update" ON storage.objects;
CREATE POLICY "designer_profiles_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'designer-profiles' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'designer-profiles' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "designer_profiles_delete" ON storage.objects;
CREATE POLICY "designer_profiles_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'designer-profiles' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "designer_profiles_select" ON storage.objects;
CREATE POLICY "designer_profiles_select" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'designer-profiles');

-- quotation-attachments: private; path {quote_id}/quotation|payment/{file}
UPDATE storage.buckets
SET public = false, file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'quotation-attachments';

DROP POLICY IF EXISTS "Designers can upload quotation files" ON storage.objects;
DROP POLICY IF EXISTS "Customers can upload payment receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their quotation attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;

DROP POLICY IF EXISTS "quote_files_designer_insert" ON storage.objects;
CREATE POLICY "quote_files_designer_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quotation-attachments'
  AND (storage.foldername(storage.objects.name))[2] = 'quotation'
  AND EXISTS (
    SELECT 1 FROM public.designer_quotes dq
    JOIN public.designers d ON d.id = dq.designer_id
    WHERE dq.id::text = (storage.foldername(storage.objects.name))[1] AND d.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "quote_files_homeowner_insert" ON storage.objects;
CREATE POLICY "quote_files_homeowner_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quotation-attachments'
  AND (storage.foldername(storage.objects.name))[2] = 'payment'
  AND EXISTS (
    SELECT 1 FROM public.designer_quotes dq
    JOIN public.customers c ON c.id = dq.project_id
    WHERE dq.id::text = (storage.foldername(storage.objects.name))[1] AND c.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "quote_files_select" ON storage.objects;
CREATE POLICY "quote_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quotation-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.designer_quotes dq
      JOIN public.designers d ON d.id = dq.designer_id
      WHERE dq.id::text = (storage.foldername(storage.objects.name))[1] AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.designer_quotes dq
      JOIN public.customers c ON c.id = dq.project_id
      WHERE dq.id::text = (storage.foldername(storage.objects.name))[1] AND c.user_id = auth.uid()
    )
    OR public.is_active_admin()
  )
);
DROP POLICY IF EXISTS "quote_files_designer_delete" ON storage.objects;
CREATE POLICY "quote_files_designer_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'quotation-attachments' AND (storage.foldername(storage.objects.name))[2] = 'quotation'
  AND EXISTS (
    SELECT 1 FROM public.designer_quotes dq
    JOIN public.designers d ON d.id = dq.designer_id
    WHERE dq.id::text = (storage.foldername(storage.objects.name))[1] AND d.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "quote_files_homeowner_delete" ON storage.objects;
CREATE POLICY "quote_files_homeowner_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'quotation-attachments' AND (storage.foldername(storage.objects.name))[2] = 'payment'
  AND EXISTS (
    SELECT 1 FROM public.designer_quotes dq
    JOIN public.customers c ON c.id = dq.project_id
    WHERE dq.id::text = (storage.foldername(storage.objects.name))[1] AND c.user_id = auth.uid()
  )
);

-- project-gallery: private, path {customer_id}/{file}, assigned designer writes
UPDATE storage.buckets SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp']
WHERE id = 'project-gallery';

DROP POLICY IF EXISTS "Public can view project gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Designers can upload project gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Designers can update project gallery images" ON storage.objects;
DROP POLICY IF EXISTS "Designers can delete project gallery images" ON storage.objects;

DROP POLICY IF EXISTS "gallery_designer_write" ON storage.objects;
CREATE POLICY "gallery_designer_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-gallery'
  AND EXISTS (
    SELECT 1 FROM public.customers c
    JOIN public.designers d ON d.id = c.assigned_designer_id
    WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
      AND d.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "gallery_designer_update" ON storage.objects;
CREATE POLICY "gallery_designer_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-gallery' AND EXISTS (
  SELECT 1 FROM public.customers c JOIN public.designers d ON d.id = c.assigned_designer_id
  WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND d.user_id = auth.uid()))
WITH CHECK (bucket_id = 'project-gallery' AND EXISTS (
  SELECT 1 FROM public.customers c JOIN public.designers d ON d.id = c.assigned_designer_id
  WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "gallery_designer_delete" ON storage.objects;
CREATE POLICY "gallery_designer_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-gallery' AND EXISTS (
  SELECT 1 FROM public.customers c JOIN public.designers d ON d.id = c.assigned_designer_id
  WHERE c.id::text = (storage.foldername(storage.objects.name))[1] AND d.user_id = auth.uid()));
DROP POLICY IF EXISTS "gallery_select" ON storage.objects;
CREATE POLICY "gallery_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-gallery'
  AND (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id::text = (storage.foldername(storage.objects.name))[1]
        AND (c.user_id = auth.uid() OR c.assigned_designer_id IN (
          SELECT id FROM public.designers WHERE user_id = auth.uid()))
    )
    OR public.is_active_admin()
  )
);

-- project-designs: private, path {designer_id}/{project_id}/{file}
UPDATE storage.buckets SET public = false, file_size_limit = 52428800
WHERE id = 'project-designs';

DROP POLICY IF EXISTS "Designers can upload design files" ON storage.objects;
DROP POLICY IF EXISTS "Designers can view their design files" ON storage.objects;
DROP POLICY IF EXISTS "Designers can update their design files" ON storage.objects;
DROP POLICY IF EXISTS "Designers can delete their design files" ON storage.objects;
DROP POLICY IF EXISTS "Customers can view design files for their projects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all design files" ON storage.objects;

DROP POLICY IF EXISTS "design_files_insert" ON storage.objects;
CREATE POLICY "design_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-designs'
  AND EXISTS (
    SELECT 1 FROM public.designers d
    JOIN public.customers c ON c.assigned_designer_id = d.id
    WHERE d.user_id = auth.uid()
      AND d.id::text = (storage.foldername(storage.objects.name))[1]
      AND c.id::text = (storage.foldername(storage.objects.name))[2]
  )
);
DROP POLICY IF EXISTS "design_files_update" ON storage.objects;
CREATE POLICY "design_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-designs' AND (storage.foldername(storage.objects.name))[1] IN (
  SELECT id::text FROM public.designers WHERE user_id = auth.uid()))
WITH CHECK (bucket_id = 'project-designs' AND (storage.foldername(storage.objects.name))[1] IN (
  SELECT id::text FROM public.designers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "design_files_delete" ON storage.objects;
CREATE POLICY "design_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-designs' AND (storage.foldername(storage.objects.name))[1] IN (
  SELECT id::text FROM public.designers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "design_files_select" ON storage.objects;
CREATE POLICY "design_files_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-designs'
  AND (
    (storage.foldername(storage.objects.name))[1] IN (SELECT id::text FROM public.designers WHERE user_id = auth.uid())
    OR (storage.foldername(storage.objects.name))[2] IN (SELECT id::text FROM public.customers WHERE user_id = auth.uid())
    OR public.is_active_admin()
  )
);

-- payment-proofs: owner folder, admin read, no public access
UPDATE storage.buckets
SET public = false, file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf']
WHERE id = 'payment-proofs';

DROP POLICY IF EXISTS "users_upload_own_payment_proofs" ON storage.objects;
DROP POLICY IF EXISTS "users_read_own_payment_proofs" ON storage.objects;
DROP POLICY IF EXISTS "admins_read_payment_proofs" ON storage.objects;

CREATE POLICY "users_upload_own_payment_proofs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
CREATE POLICY "users_read_own_payment_proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND (storage.foldername(storage.objects.name))[1] = auth.uid()::text);
CREATE POLICY "admins_read_payment_proofs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_active_admin());

-- wallpaper catalog: public read, active admin write
DROP POLICY IF EXISTS "Public can view wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update wallpaper images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;

CREATE POLICY "Public can view wallpaper images" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'wallpaper-images');
CREATE POLICY "Admins can upload wallpaper images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wallpaper-images' AND public.is_active_admin());
CREATE POLICY "Admins can update wallpaper images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'wallpaper-images' AND public.is_active_admin())
WITH CHECK (bucket_id = 'wallpaper-images' AND public.is_active_admin());
DROP POLICY IF EXISTS "Admins can delete wallpaper images" ON storage.objects;
CREATE POLICY "Admins can delete wallpaper images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wallpaper-images' AND public.is_active_admin());

-- wallpaper order previews: private, admin write, owning homeowner read
UPDATE storage.buckets SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp']
WHERE id = 'wallpaper-orders';

DROP POLICY IF EXISTS "Authenticated users can upload wallpaper order files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view wallpaper order files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update wallpaper order files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wallpaper order files" ON storage.objects;

DROP POLICY IF EXISTS "wallpaper_orders_admin_insert" ON storage.objects;
CREATE POLICY "wallpaper_orders_admin_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wallpaper-orders' AND public.is_active_admin());
DROP POLICY IF EXISTS "wallpaper_orders_admin_update" ON storage.objects;
CREATE POLICY "wallpaper_orders_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'wallpaper-orders' AND public.is_active_admin())
WITH CHECK (bucket_id = 'wallpaper-orders' AND public.is_active_admin());
DROP POLICY IF EXISTS "wallpaper_orders_admin_delete" ON storage.objects;
CREATE POLICY "wallpaper_orders_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wallpaper-orders' AND public.is_active_admin());
DROP POLICY IF EXISTS "wallpaper_orders_select" ON storage.objects;
CREATE POLICY "wallpaper_orders_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'wallpaper-orders'
  AND (
    public.is_active_admin()
    OR EXISTS (
      SELECT 1 FROM public.wallpaper_orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id::text = (storage.foldername(storage.objects.name))[1] AND c.user_id = auth.uid()
    )
  )
);

-- ai-floor-plans: folder is designers.id, comparison is uuid = uuid
DROP POLICY IF EXISTS "designers upload own ai floor plans" ON storage.objects;
DROP POLICY IF EXISTS "designers read own ai floor plans" ON storage.objects;
DROP POLICY IF EXISTS "designers update own ai floor plans" ON storage.objects;
DROP POLICY IF EXISTS "designers delete own ai floor plans" ON storage.objects;

CREATE POLICY "designers upload own ai floor plans" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-floor-plans' AND (storage.foldername(storage.objects.name))[1] = (
  SELECT d.id::text FROM public.designers d WHERE d.user_id = auth.uid()));
CREATE POLICY "designers read own ai floor plans" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-floor-plans' AND (
  (storage.foldername(storage.objects.name))[1] = (SELECT d.id::text FROM public.designers d WHERE d.user_id = auth.uid())
  OR public.is_active_admin()));
DROP POLICY IF EXISTS "designers update own ai floor plans" ON storage.objects;
CREATE POLICY "designers update own ai floor plans" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ai-floor-plans' AND (storage.foldername(storage.objects.name))[1] = (
  SELECT d.id::text FROM public.designers d WHERE d.user_id = auth.uid()))
WITH CHECK (bucket_id = 'ai-floor-plans' AND (storage.foldername(storage.objects.name))[1] = (
  SELECT d.id::text FROM public.designers d WHERE d.user_id = auth.uid()));
DROP POLICY IF EXISTS "designers delete own ai floor plans" ON storage.objects;
CREATE POLICY "designers delete own ai floor plans" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-floor-plans' AND (storage.foldername(storage.objects.name))[1] = (
  SELECT d.id::text FROM public.designers d WHERE d.user_id = auth.uid()));
