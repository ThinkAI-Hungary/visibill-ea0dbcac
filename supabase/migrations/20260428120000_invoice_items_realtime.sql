-- Add invoice_items to supabase_realtime publication to enable live UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_items;
