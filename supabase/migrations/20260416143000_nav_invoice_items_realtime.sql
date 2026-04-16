-- Add nav_invoice_items table to Realtime publication so changes broadcast to the frontend
ALTER PUBLICATION supabase_realtime ADD TABLE nav_invoice_items;
