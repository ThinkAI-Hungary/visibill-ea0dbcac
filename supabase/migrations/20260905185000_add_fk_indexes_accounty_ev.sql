-- ===========================================================================
-- Batch FK-3: Accounty, EV Nyilvantartasok & HR Subsystem
-- Missing Foreign Key Indexes (Performance Advisor: unindexed_foreign_keys)
-- Total indexes: 64
-- ===========================================================================

-- FK: accounty_condo_maintenance_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_condo_maintenance_company_id ON public.accounty_condo_maintenance(company_id);

-- FK: accounty_condo_units_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_condo_units_company_id ON public.accounty_condo_units(company_id);

-- FK: accounty_cost_centers_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_cost_centers_company_id ON public.accounty_cost_centers(company_id);

-- FK: accounty_cost_centers_parent_id_fkey -> accounty_cost_centers(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_cost_centers_parent_id ON public.accounty_cost_centers(parent_id);

-- FK: accounty_data_contracts_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_data_contracts_company_id ON public.accounty_data_contracts(company_id);

-- FK: accounty_departments_site_id_fkey -> accounty_sites(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_departments_site_id ON public.accounty_departments(site_id);

-- FK: accounty_dependents_employee_id_fkey -> accounty_employees(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_dependents_employee_id ON public.accounty_dependents(employee_id);

-- FK: accounty_documents_employee_id_fkey -> accounty_employees(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_documents_employee_id ON public.accounty_documents(employee_id);

-- FK: accounty_employee_jobs_employee_id_fkey -> accounty_employees(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_employee_jobs_employee_id ON public.accounty_employee_jobs(employee_id);

-- FK: accounty_employments_project_id_fkey -> projects(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_employments_project_id ON public.accounty_employments(project_id);

-- FK: accounty_ev_audit_log_performed_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_audit_log_performed_by ON public.accounty_ev_audit_log(performed_by);

-- FK: accounty_ev_chamber_payments_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_chamber_payments_created_by ON public.accounty_ev_chamber_payments(created_by);

-- FK: accounty_ev_client_settings_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_client_settings_created_by ON public.accounty_ev_client_settings(created_by);

-- FK: accounty_ev_contribution_calc_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_contribution_calc_created_by ON public.accounty_ev_contribution_calc(created_by);

-- FK: accounty_ev_lifecycle_events_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_lifecycle_events_created_by ON public.accounty_ev_lifecycle_events(created_by);

-- FK: accounty_ev_records_consignment_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_consignment_company_id ON public.accounty_ev_records_consignment(company_id);

-- FK: accounty_ev_records_consignment_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_consignment_created_by ON public.accounty_ev_records_consignment(created_by);

-- FK: accounty_ev_records_fixed_assets_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_fixed_assets_created_by ON public.accounty_ev_records_fixed_assets(created_by);

-- FK: accounty_ev_records_inventory_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_inventory_company_id ON public.accounty_ev_records_inventory(company_id);

-- FK: accounty_ev_records_inventory_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_inventory_created_by ON public.accounty_ev_records_inventory(created_by);

-- FK: accounty_ev_records_investments_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_investments_company_id ON public.accounty_ev_records_investments(company_id);

-- FK: accounty_ev_records_investments_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_investments_created_by ON public.accounty_ev_records_investments(created_by);

-- FK: accounty_ev_records_investments_fixed_asset_id_fkey -> accounty_ev_records_fixed_assets(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_investments_fixed_asset_id ON public.accounty_ev_records_investments(fixed_asset_id);

-- FK: accounty_ev_records_other_claims_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_other_claims_company_id ON public.accounty_ev_records_other_claims(company_id);

-- FK: accounty_ev_records_other_claims_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_other_claims_created_by ON public.accounty_ev_records_other_claims(created_by);

-- FK: accounty_ev_records_payables_cashbook_entry_id_fkey -> accounty_penztarkonyv_tetel(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_payables_cashbook_entry_id ON public.accounty_ev_records_payables(cashbook_entry_id);

-- FK: accounty_ev_records_payables_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_payables_created_by ON public.accounty_ev_records_payables(created_by);

-- FK: accounty_ev_records_receivables_cashbook_entry_id_fkey -> accounty_penztarkonyv_tetel(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_receivables_cashbook_entry_id ON public.accounty_ev_records_receivables(cashbook_entry_id);

-- FK: accounty_ev_records_receivables_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_receivables_created_by ON public.accounty_ev_records_receivables(created_by);

-- FK: accounty_ev_records_scrapping_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_scrapping_company_id ON public.accounty_ev_records_scrapping(company_id);

-- FK: accounty_ev_records_scrapping_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_scrapping_created_by ON public.accounty_ev_records_scrapping(created_by);

-- FK: accounty_ev_records_scrapping_fixed_asset_id_fkey -> accounty_ev_records_fixed_assets(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_scrapping_fixed_asset_id ON public.accounty_ev_records_scrapping(fixed_asset_id);

-- FK: accounty_ev_records_securities_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_securities_company_id ON public.accounty_ev_records_securities(company_id);

-- FK: accounty_ev_records_securities_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_securities_created_by ON public.accounty_ev_records_securities(created_by);

-- FK: accounty_ev_records_strict_forms_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_strict_forms_company_id ON public.accounty_ev_records_strict_forms(company_id);

-- FK: accounty_ev_records_strict_forms_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_strict_forms_created_by ON public.accounty_ev_records_strict_forms(created_by);

-- FK: accounty_ev_records_subcontractors_cashbook_entry_id_fkey -> accounty_penztarkonyv_tetel(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_subcontractors_cashbook_entry_id ON public.accounty_ev_records_subcontractors(cashbook_entry_id);

-- FK: accounty_ev_records_subcontractors_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_subcontractors_company_id ON public.accounty_ev_records_subcontractors(company_id);

-- FK: accounty_ev_records_subcontractors_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_subcontractors_created_by ON public.accounty_ev_records_subcontractors(created_by);

-- FK: accounty_ev_records_vehicle_log_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_vehicle_log_created_by ON public.accounty_ev_records_vehicle_log(created_by);

-- FK: accounty_ev_records_wages_cashbook_entry_id_fkey -> accounty_penztarkonyv_tetel(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_wages_cashbook_entry_id ON public.accounty_ev_records_wages(cashbook_entry_id);

-- FK: accounty_ev_records_wages_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_wages_company_id ON public.accounty_ev_records_wages(company_id);

-- FK: accounty_ev_records_wages_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_records_wages_created_by ON public.accounty_ev_records_wages(created_by);

-- FK: accounty_ev_tax_returns_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_tax_returns_created_by ON public.accounty_ev_tax_returns(created_by);

-- FK: accounty_ev_vat_returns_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_ev_vat_returns_created_by ON public.accounty_ev_vat_returns(created_by);

-- FK: accounty_gdpr_requests_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_gdpr_requests_company_id ON public.accounty_gdpr_requests(company_id);

-- FK: accounty_gdpr_requests_handled_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_gdpr_requests_handled_by ON public.accounty_gdpr_requests(handled_by);

-- FK: accounty_job_modifications_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_job_modifications_company_id ON public.accounty_job_modifications(company_id);

-- FK: accounty_job_modifications_employee_id_fkey -> accounty_employees(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_job_modifications_employee_id ON public.accounty_job_modifications(employee_id);

-- FK: accounty_job_modifications_job_id_fkey -> accounty_employee_jobs(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_job_modifications_job_id ON public.accounty_job_modifications(job_id);

-- FK: accounty_legal_updates_created_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_legal_updates_created_by ON public.accounty_legal_updates(created_by);

-- FK: accounty_module_permissions_user_id_fkey -> auth.users(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_module_permissions_user_id ON public.accounty_module_permissions(user_id);

-- FK: accounty_nav_representations_company_id_fkey -> companies(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_nav_representations_company_id ON public.accounty_nav_representations(company_id);

-- FK: accounty_org_report_lines_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_org_report_lines_created_by ON public.accounty_org_report_lines(created_by);

-- FK: accounty_penztarkonyv_period_close_closed_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_penztarkonyv_period_close_closed_by ON public.accounty_penztarkonyv_period_close(closed_by);

-- FK: accounty_penztarkonyv_tetel_created_by_fkey -> auth.users(id) [ON DELETE NO ACTION]
CREATE INDEX IF NOT EXISTS idx_accounty_penztarkonyv_tetel_created_by ON public.accounty_penztarkonyv_tetel(created_by);

-- FK: accounty_push_subscriptions_user_id_fkey -> auth.users(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_push_subscriptions_user_id ON public.accounty_push_subscriptions(user_id);

-- FK: accounty_tao_yearly_approved_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_tao_yearly_approved_by ON public.accounty_tao_yearly(approved_by);

-- FK: accounty_tao_yearly_submitted_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_tao_yearly_submitted_by ON public.accounty_tao_yearly(submitted_by);

-- FK: accounty_tax_params_global_updated_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_tax_params_global_updated_by ON public.accounty_tax_params_global(updated_by);

-- FK: accounty_template_versions_changed_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_template_versions_changed_by ON public.accounty_template_versions(changed_by);

-- FK: accounty_template_versions_template_id_fkey -> accounty_templates(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_template_versions_template_id ON public.accounty_template_versions(template_id);

-- FK: accounty_templates_created_by_fkey -> auth.users(id) [ON DELETE SET NULL]
CREATE INDEX IF NOT EXISTS idx_accounty_templates_created_by ON public.accounty_templates(created_by);

-- FK: accounty_transfers_employee_id_fkey -> accounty_employees(id) [ON DELETE CASCADE]
CREATE INDEX IF NOT EXISTS idx_accounty_transfers_employee_id ON public.accounty_transfers(employee_id);
