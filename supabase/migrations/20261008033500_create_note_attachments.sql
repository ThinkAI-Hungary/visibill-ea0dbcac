-- Migration: 20261008033500_create_note_attachments.sql
-- Description: Create note_attachments table, RLS policies, and configure invoice-attachments storage bucket.

-- 1. Create table public.note_attachments
CREATE TABLE IF NOT EXISTS public.note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  content_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON public.note_attachments(note_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_company_id ON public.note_attachments(company_id);

-- 3. Enable RLS
ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies on note_attachments
DROP POLICY IF EXISTS "note_attachments_select_policy" ON public.note_attachments;
CREATE POLICY "note_attachments_select_policy" ON public.note_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_attachments.note_id
        AND (
          (n.is_private = true AND n.user_id = auth.uid())
          OR
          (n.is_private = false AND EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = note_attachments.company_id AND cm.user_id = auth.uid()
          ))
        )
    )
  );

DROP POLICY IF EXISTS "note_attachments_insert_policy" ON public.note_attachments;
CREATE POLICY "note_attachments_insert_policy" ON public.note_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_attachments.note_id
        AND (
          (n.is_private = true AND n.user_id = auth.uid())
          OR
          (n.is_private = false AND EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = note_attachments.company_id AND cm.user_id = auth.uid()
          ))
        )
    )
  );

DROP POLICY IF EXISTS "note_attachments_delete_policy" ON public.note_attachments;
CREATE POLICY "note_attachments_delete_policy" ON public.note_attachments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      WHERE n.id = note_attachments.note_id
        AND (
          (n.is_private = true AND n.user_id = auth.uid())
          OR
          (n.is_private = false AND EXISTS (
            SELECT 1 FROM public.company_members cm
            WHERE cm.company_id = note_attachments.company_id AND cm.user_id = auth.uid()
          ))
        )
    )
  );

DROP POLICY IF EXISTS "note_attachments_service_role_all" ON public.note_attachments;
CREATE POLICY "note_attachments_service_role_all" ON public.note_attachments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Storage Bucket Configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-attachments',
  'invoice-attachments',
  true,
  20971520, -- 20MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 6. Storage Policies for invoice-attachments bucket
DROP POLICY IF EXISTS "Public read for invoice attachments" ON storage.objects;
CREATE POLICY "Public read for invoice attachments" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'invoice-attachments');

DROP POLICY IF EXISTS "Authenticated users can upload invoice attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload invoice attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'invoice-attachments'
    AND auth.uid() IS NOT NULL
    AND ((storage.foldername(name))[1] IN (
      SELECT cm.company_id::text FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Authenticated users can delete invoice attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete invoice attachments" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'invoice-attachments'
    AND auth.uid() IS NOT NULL
    AND ((storage.foldername(name))[1] IN (
      SELECT cm.company_id::text FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ))
  );
