-- ===========================================================================
-- Batch FK-1: Core Billing, Shipments, Rules & Petty Cash
-- Missing Foreign Key Indexes (Performance Advisor: unindexed_foreign_keys)
-- Total indexes: 15
-- ===========================================================================

-- FK: company_prompt_rules_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_company_prompt_rules_company_id ON public.company_prompt_rules(company_id);

-- FK: company_prompt_rules_created_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_company_prompt_rules_created_by ON public.company_prompt_rules(created_by);

-- FK: employee_rates_project_id_fkey -> projects(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_employee_rates_project_id ON public.employee_rates(project_id);

-- FK: feedback_assigned_to_fkey -> profiles(user_id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_feedback_assigned_to ON public.feedback(assigned_to);

-- FK: invoice_items_project_id_fkey -> projects(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_invoice_items_project_id ON public.invoice_items(project_id);

-- FK: invoices_approved_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_invoices_approved_by ON public.invoices(approved_by);

-- FK: item_project_rules_project_id_fkey -> projects(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_item_project_rules_project_id ON public.item_project_rules(project_id);

-- FK: item_project_rules_user_id_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_item_project_rules_user_id ON public.item_project_rules(user_id);

-- FK: petty_cash_entries_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_created_by ON public.petty_cash_entries(created_by);

-- FK: petty_cash_registers_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_petty_cash_registers_created_by ON public.petty_cash_registers(created_by);

-- FK: petty_cash_routing_rules_target_register_id_fkey -> petty_cash_registers(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_petty_cash_routing_rules_target_register_id ON public.petty_cash_routing_rules(target_register_id);

-- FK: shipment_import_batches_uploaded_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_shipment_import_batches_uploaded_by ON public.shipment_import_batches(uploaded_by);

-- FK: shipment_matches_resolved_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_shipment_matches_resolved_by ON public.shipment_matches(resolved_by);

-- FK: shipments_import_batch_id_fkey -> shipment_import_batches(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_shipments_import_batch_id ON public.shipments(import_batch_id);

-- FK: transaction_rules_target_gl_account_id_fkey -> gl_accounts(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_transaction_rules_target_gl_account_id ON public.transaction_rules(target_gl_account_id);
