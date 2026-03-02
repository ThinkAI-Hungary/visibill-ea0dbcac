ALTER TABLE nav_invoice_items
  DROP CONSTRAINT nav_invoice_items_nav_invoice_id_fkey;

ALTER TABLE nav_invoice_items
  ADD CONSTRAINT nav_invoice_items_nav_invoice_id_fkey
  FOREIGN KEY (nav_invoice_id) REFERENCES nav_invoices(id) ON DELETE CASCADE;