-- Create notes table
CREATE TABLE public.notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    is_private boolean NOT NULL DEFAULT true,
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX idx_notes_company_id ON public.notes(company_id);
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_invoice_id ON public.notes(invoice_id);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Select policy: User can read if it is their private note OR if it is a shared note of their company
CREATE POLICY "Users can select own or shared company notes" ON public.notes
    FOR SELECT
    USING (
        (is_private = true AND user_id = auth.uid())
        OR
        (is_private = false AND company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        ))
    );

-- Insert policy: User can insert notes for a company they belong to as themselves
CREATE POLICY "Users can insert notes as themselves for their company" ON public.notes
    FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND
        company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        )
    );

-- Update policy: User can update their own private notes, or shared company notes if they are a member
CREATE POLICY "Users can update own or shared company notes" ON public.notes
    FOR UPDATE
    USING (
        (is_private = true AND user_id = auth.uid())
        OR
        (is_private = false AND company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        ))
    );

-- Delete policy: User can delete their own private notes, or shared company notes if they are a member
CREATE POLICY "Users can delete own or shared company notes" ON public.notes
    FOR DELETE
    USING (
        (is_private = true AND user_id = auth.uid())
        OR
        (is_private = false AND company_id IN (
            SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
        ))
    );

-- Trigger for updated_at
CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
