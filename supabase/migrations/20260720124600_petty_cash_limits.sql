-- Add related_party boolean column to public.partners
ALTER TABLE public.partners 
ADD COLUMN IF NOT EXISTS related_party BOOLEAN DEFAULT false;

-- Add partner_id reference column to public.petty_cash_entries
ALTER TABLE public.petty_cash_entries 
ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

-- Create helper function to query monthly cumulative cash total for a partner
CREATE OR REPLACE FUNCTION public.get_partner_monthly_cash_total(
    p_company_id UUID,
    p_partner_id UUID,
    p_partner_name TEXT,
    p_date DATE
) RETURNS NUMERIC AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_total NUMERIC;
BEGIN
    -- Get start and end of the month for the given date
    v_start_date := date_trunc('month', p_date)::DATE;
    v_end_date := (date_trunc('month', p_date) + interval '1 month - 1 day')::DATE;
    
    -- Calculate cumulative absolute sum of all cash entries for this partner in HUF
    SELECT COALESCE(SUM(ABS(e.amount)), 0) INTO v_total
    FROM public.petty_cash_entries e
    WHERE e.company_id = p_company_id
      AND e.entry_date >= v_start_date
      AND e.entry_date <= v_end_date
      AND (
          -- Direct partner association
          e.partner_id = p_partner_id
          
          -- Direct description search fallback
          OR (p_partner_name IS NOT NULL AND p_partner_name <> '' AND e.description ILIKE '%' || p_partner_name || '%')
          
          -- Indirect matches via linked invoices seller/buyer name
          OR (p_partner_id IS NOT NULL AND e.source_id IN (
              SELECT i.id FROM public.invoices i
              WHERE i.company_id = p_company_id
                AND (
                    (i.invoice_direction = 'INBOUND' AND i.elado_nev IN (SELECT name FROM public.partners WHERE id = p_partner_id))
                    OR (i.invoice_direction = 'OUTBOUND' AND i.vevo_nev IN (SELECT name FROM public.partners WHERE id = p_partner_id))
                )
          ))
      );
    RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
