-- Create table for backend background job notifications
CREATE TABLE IF NOT EXISTS public.gl_upload_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gl_upload_notifications ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for the owning company
CREATE POLICY "Users can view notifications for their company"
    ON public.gl_upload_notifications
    FOR SELECT
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_users 
        WHERE user_id = auth.uid()
    ));

-- Also allow inserting (so triggers or other backend components could theoretically insert if not using service roll)
-- Typically, n8n uses service_role key which bypasses RLS, but just in case we allow inserts if needed:
CREATE POLICY "Users can insert notifications for their company"
    ON public.gl_upload_notifications
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id 
        FROM public.company_users 
        WHERE user_id = auth.uid()
    ));

-- Add to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE gl_upload_notifications;
