/*
  # Create Storage Bucket for Quotation Attachments

  ## Overview
  Creates a storage bucket to store quotation files and payment receipts securely.

  ## Changes
  
  1. New Storage Bucket
    - `quotation-attachments` - bucket for storing quotation PDFs and payment receipts
  
  2. Security Policies
    - Designers can upload quotation files for their own quotes
    - Customers can upload payment receipts for quotes on their projects
    - Both parties can view their respective files
    - Files are organized by quote ID for easy management
  
  ## Notes
  - Files are stored with path: {quote_id}/{file_type}/{filename}
  - Supports PDF, image formats (JPG, PNG), and common document formats
*/

-- Create the storage bucket for quotation attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotation-attachments',
  'quotation-attachments',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Designers can upload quotation files" ON storage.objects;
  DROP POLICY IF EXISTS "Customers can upload payment receipts" ON storage.objects;
  DROP POLICY IF EXISTS "Users can view their quotation attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
END $$;

-- Policy: Allow designers to upload quotation files for their own quotes
CREATE POLICY "Designers can upload quotation files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotation-attachments' 
  AND auth.uid() IN (
    SELECT d.user_id 
    FROM designers d
    JOIN designer_quotes dq ON dq.designer_id = d.id
    WHERE (storage.foldername(name))[1] = dq.id::text
  )
);

-- Policy: Allow customers to upload payment receipts for their project quotes
DROP POLICY IF EXISTS "Customers can upload payment receipts" ON storage.objects;
CREATE POLICY "Customers can upload payment receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quotation-attachments'
  AND auth.uid() IN (
    SELECT c.user_id
    FROM customers c
    JOIN designer_quotes dq ON dq.project_id = c.id
    WHERE (storage.foldername(name))[1] = dq.id::text
  )
);

-- Policy: Allow users to view files they have access to
DROP POLICY IF EXISTS "Users can view their quotation attachments" ON storage.objects;
CREATE POLICY "Users can view their quotation attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'quotation-attachments'
  AND (
    -- Designers can view files for their quotes
    auth.uid() IN (
      SELECT d.user_id
      FROM designers d
      JOIN designer_quotes dq ON dq.designer_id = d.id
      WHERE (storage.foldername(name))[1] = dq.id::text
    )
    OR
    -- Customers can view files for quotes on their projects
    auth.uid() IN (
      SELECT c.user_id
      FROM customers c
      JOIN designer_quotes dq ON dq.project_id = c.id
      WHERE (storage.foldername(name))[1] = dq.id::text
    )
  )
);

-- Policy: Allow users to delete their own uploaded files
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'quotation-attachments'
  AND (
    -- Designers can delete quotation files they uploaded
    (
      (storage.foldername(name))[2] = 'quotation'
      AND auth.uid() IN (
        SELECT d.user_id
        FROM designers d
        JOIN designer_quotes dq ON dq.designer_id = d.id
        WHERE (storage.foldername(name))[1] = dq.id::text
      )
    )
    OR
    -- Customers can delete payment receipts they uploaded
    (
      (storage.foldername(name))[2] = 'payment'
      AND auth.uid() IN (
        SELECT c.user_id
        FROM customers c
        JOIN designer_quotes dq ON dq.project_id = c.id
        WHERE (storage.foldername(name))[1] = dq.id::text
      )
    )
  )
);