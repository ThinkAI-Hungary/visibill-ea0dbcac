-- ===========================================================================
-- Batch POL-5: Accounty EV and Legacy Duplicated Policies Consolidation
-- Eliminates multiple_permissive_policies on:
--   22 EV & Penztarkonyv tables + 5 Legacy Duplication tables
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Standard EV & Reporting Tables: change _modify from ALL to write-only
-- ---------------------------------------------------------------------------

-- Table: accounty_ev_chamber_payments
DROP POLICY IF EXISTS "accounty_ev_chamber_payments_modify" ON public.accounty_ev_chamber_payments;
DROP POLICY IF EXISTS "accounty_ev_chamber_payments_insert" ON public.accounty_ev_chamber_payments;
DROP POLICY IF EXISTS "accounty_ev_chamber_payments_update" ON public.accounty_ev_chamber_payments;
DROP POLICY IF EXISTS "accounty_ev_chamber_payments_delete" ON public.accounty_ev_chamber_payments;
CREATE POLICY "accounty_ev_chamber_payments_insert" ON public.accounty_ev_chamber_payments FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_chamber_payments_update" ON public.accounty_ev_chamber_payments FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_chamber_payments_delete" ON public.accounty_ev_chamber_payments FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_client_settings
DROP POLICY IF EXISTS "accounty_ev_client_settings_modify" ON public.accounty_ev_client_settings;
DROP POLICY IF EXISTS "accounty_ev_client_settings_insert" ON public.accounty_ev_client_settings;
DROP POLICY IF EXISTS "accounty_ev_client_settings_update" ON public.accounty_ev_client_settings;
DROP POLICY IF EXISTS "accounty_ev_client_settings_delete" ON public.accounty_ev_client_settings;
CREATE POLICY "accounty_ev_client_settings_insert" ON public.accounty_ev_client_settings FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_client_settings_update" ON public.accounty_ev_client_settings FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_client_settings_delete" ON public.accounty_ev_client_settings FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_contribution_calc
DROP POLICY IF EXISTS "accounty_ev_contribution_calc_modify" ON public.accounty_ev_contribution_calc;
DROP POLICY IF EXISTS "accounty_ev_contribution_calc_insert" ON public.accounty_ev_contribution_calc;
DROP POLICY IF EXISTS "accounty_ev_contribution_calc_update" ON public.accounty_ev_contribution_calc;
DROP POLICY IF EXISTS "accounty_ev_contribution_calc_delete" ON public.accounty_ev_contribution_calc;
CREATE POLICY "accounty_ev_contribution_calc_insert" ON public.accounty_ev_contribution_calc FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_contribution_calc_update" ON public.accounty_ev_contribution_calc FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_contribution_calc_delete" ON public.accounty_ev_contribution_calc FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_hipa_calc
DROP POLICY IF EXISTS "accounty_ev_hipa_calc_modify" ON public.accounty_ev_hipa_calc;
DROP POLICY IF EXISTS "accounty_ev_hipa_calc_insert" ON public.accounty_ev_hipa_calc;
DROP POLICY IF EXISTS "accounty_ev_hipa_calc_update" ON public.accounty_ev_hipa_calc;
DROP POLICY IF EXISTS "accounty_ev_hipa_calc_delete" ON public.accounty_ev_hipa_calc;
CREATE POLICY "accounty_ev_hipa_calc_insert" ON public.accounty_ev_hipa_calc FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_hipa_calc_update" ON public.accounty_ev_hipa_calc FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_hipa_calc_delete" ON public.accounty_ev_hipa_calc FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_lifecycle_events
DROP POLICY IF EXISTS "accounty_ev_lifecycle_events_modify" ON public.accounty_ev_lifecycle_events;
DROP POLICY IF EXISTS "accounty_ev_lifecycle_events_insert" ON public.accounty_ev_lifecycle_events;
DROP POLICY IF EXISTS "accounty_ev_lifecycle_events_update" ON public.accounty_ev_lifecycle_events;
DROP POLICY IF EXISTS "accounty_ev_lifecycle_events_delete" ON public.accounty_ev_lifecycle_events;
CREATE POLICY "accounty_ev_lifecycle_events_insert" ON public.accounty_ev_lifecycle_events FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_lifecycle_events_update" ON public.accounty_ev_lifecycle_events FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_lifecycle_events_delete" ON public.accounty_ev_lifecycle_events FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_consignment
DROP POLICY IF EXISTS "accounty_ev_records_consignment_modify" ON public.accounty_ev_records_consignment;
DROP POLICY IF EXISTS "accounty_ev_records_consignment_insert" ON public.accounty_ev_records_consignment;
DROP POLICY IF EXISTS "accounty_ev_records_consignment_update" ON public.accounty_ev_records_consignment;
DROP POLICY IF EXISTS "accounty_ev_records_consignment_delete" ON public.accounty_ev_records_consignment;
CREATE POLICY "accounty_ev_records_consignment_insert" ON public.accounty_ev_records_consignment FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_consignment_update" ON public.accounty_ev_records_consignment FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_consignment_delete" ON public.accounty_ev_records_consignment FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_fixed_assets
DROP POLICY IF EXISTS "accounty_ev_records_fixed_assets_modify" ON public.accounty_ev_records_fixed_assets;
DROP POLICY IF EXISTS "accounty_ev_records_fixed_assets_insert" ON public.accounty_ev_records_fixed_assets;
DROP POLICY IF EXISTS "accounty_ev_records_fixed_assets_update" ON public.accounty_ev_records_fixed_assets;
DROP POLICY IF EXISTS "accounty_ev_records_fixed_assets_delete" ON public.accounty_ev_records_fixed_assets;
CREATE POLICY "accounty_ev_records_fixed_assets_insert" ON public.accounty_ev_records_fixed_assets FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_fixed_assets_update" ON public.accounty_ev_records_fixed_assets FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_fixed_assets_delete" ON public.accounty_ev_records_fixed_assets FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_inventory
DROP POLICY IF EXISTS "accounty_ev_records_inventory_modify" ON public.accounty_ev_records_inventory;
DROP POLICY IF EXISTS "accounty_ev_records_inventory_insert" ON public.accounty_ev_records_inventory;
DROP POLICY IF EXISTS "accounty_ev_records_inventory_update" ON public.accounty_ev_records_inventory;
DROP POLICY IF EXISTS "accounty_ev_records_inventory_delete" ON public.accounty_ev_records_inventory;
CREATE POLICY "accounty_ev_records_inventory_insert" ON public.accounty_ev_records_inventory FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_inventory_update" ON public.accounty_ev_records_inventory FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_inventory_delete" ON public.accounty_ev_records_inventory FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_investments
DROP POLICY IF EXISTS "accounty_ev_records_investments_modify" ON public.accounty_ev_records_investments;
DROP POLICY IF EXISTS "accounty_ev_records_investments_insert" ON public.accounty_ev_records_investments;
DROP POLICY IF EXISTS "accounty_ev_records_investments_update" ON public.accounty_ev_records_investments;
DROP POLICY IF EXISTS "accounty_ev_records_investments_delete" ON public.accounty_ev_records_investments;
CREATE POLICY "accounty_ev_records_investments_insert" ON public.accounty_ev_records_investments FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_investments_update" ON public.accounty_ev_records_investments FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_investments_delete" ON public.accounty_ev_records_investments FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_other_claims
DROP POLICY IF EXISTS "accounty_ev_records_other_claims_modify" ON public.accounty_ev_records_other_claims;
DROP POLICY IF EXISTS "accounty_ev_records_other_claims_insert" ON public.accounty_ev_records_other_claims;
DROP POLICY IF EXISTS "accounty_ev_records_other_claims_update" ON public.accounty_ev_records_other_claims;
DROP POLICY IF EXISTS "accounty_ev_records_other_claims_delete" ON public.accounty_ev_records_other_claims;
CREATE POLICY "accounty_ev_records_other_claims_insert" ON public.accounty_ev_records_other_claims FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_other_claims_update" ON public.accounty_ev_records_other_claims FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_other_claims_delete" ON public.accounty_ev_records_other_claims FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_payables
DROP POLICY IF EXISTS "accounty_ev_records_payables_modify" ON public.accounty_ev_records_payables;
DROP POLICY IF EXISTS "accounty_ev_records_payables_insert" ON public.accounty_ev_records_payables;
DROP POLICY IF EXISTS "accounty_ev_records_payables_update" ON public.accounty_ev_records_payables;
DROP POLICY IF EXISTS "accounty_ev_records_payables_delete" ON public.accounty_ev_records_payables;
CREATE POLICY "accounty_ev_records_payables_insert" ON public.accounty_ev_records_payables FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_payables_update" ON public.accounty_ev_records_payables FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_payables_delete" ON public.accounty_ev_records_payables FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_receivables
DROP POLICY IF EXISTS "accounty_ev_records_receivables_modify" ON public.accounty_ev_records_receivables;
DROP POLICY IF EXISTS "accounty_ev_records_receivables_insert" ON public.accounty_ev_records_receivables;
DROP POLICY IF EXISTS "accounty_ev_records_receivables_update" ON public.accounty_ev_records_receivables;
DROP POLICY IF EXISTS "accounty_ev_records_receivables_delete" ON public.accounty_ev_records_receivables;
CREATE POLICY "accounty_ev_records_receivables_insert" ON public.accounty_ev_records_receivables FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_receivables_update" ON public.accounty_ev_records_receivables FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_receivables_delete" ON public.accounty_ev_records_receivables FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_scrapping
DROP POLICY IF EXISTS "accounty_ev_records_scrapping_modify" ON public.accounty_ev_records_scrapping;
DROP POLICY IF EXISTS "accounty_ev_records_scrapping_insert" ON public.accounty_ev_records_scrapping;
DROP POLICY IF EXISTS "accounty_ev_records_scrapping_update" ON public.accounty_ev_records_scrapping;
DROP POLICY IF EXISTS "accounty_ev_records_scrapping_delete" ON public.accounty_ev_records_scrapping;
CREATE POLICY "accounty_ev_records_scrapping_insert" ON public.accounty_ev_records_scrapping FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_scrapping_update" ON public.accounty_ev_records_scrapping FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_scrapping_delete" ON public.accounty_ev_records_scrapping FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_securities
DROP POLICY IF EXISTS "accounty_ev_records_securities_modify" ON public.accounty_ev_records_securities;
DROP POLICY IF EXISTS "accounty_ev_records_securities_insert" ON public.accounty_ev_records_securities;
DROP POLICY IF EXISTS "accounty_ev_records_securities_update" ON public.accounty_ev_records_securities;
DROP POLICY IF EXISTS "accounty_ev_records_securities_delete" ON public.accounty_ev_records_securities;
CREATE POLICY "accounty_ev_records_securities_insert" ON public.accounty_ev_records_securities FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_securities_update" ON public.accounty_ev_records_securities FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_securities_delete" ON public.accounty_ev_records_securities FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_strict_forms
DROP POLICY IF EXISTS "accounty_ev_records_strict_forms_modify" ON public.accounty_ev_records_strict_forms;
DROP POLICY IF EXISTS "accounty_ev_records_strict_forms_insert" ON public.accounty_ev_records_strict_forms;
DROP POLICY IF EXISTS "accounty_ev_records_strict_forms_update" ON public.accounty_ev_records_strict_forms;
DROP POLICY IF EXISTS "accounty_ev_records_strict_forms_delete" ON public.accounty_ev_records_strict_forms;
CREATE POLICY "accounty_ev_records_strict_forms_insert" ON public.accounty_ev_records_strict_forms FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_strict_forms_update" ON public.accounty_ev_records_strict_forms FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_strict_forms_delete" ON public.accounty_ev_records_strict_forms FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_subcontractors
DROP POLICY IF EXISTS "accounty_ev_records_subcontractors_modify" ON public.accounty_ev_records_subcontractors;
DROP POLICY IF EXISTS "accounty_ev_records_subcontractors_insert" ON public.accounty_ev_records_subcontractors;
DROP POLICY IF EXISTS "accounty_ev_records_subcontractors_update" ON public.accounty_ev_records_subcontractors;
DROP POLICY IF EXISTS "accounty_ev_records_subcontractors_delete" ON public.accounty_ev_records_subcontractors;
CREATE POLICY "accounty_ev_records_subcontractors_insert" ON public.accounty_ev_records_subcontractors FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_subcontractors_update" ON public.accounty_ev_records_subcontractors FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_subcontractors_delete" ON public.accounty_ev_records_subcontractors FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_vehicle_log
DROP POLICY IF EXISTS "accounty_ev_records_vehicle_log_modify" ON public.accounty_ev_records_vehicle_log;
DROP POLICY IF EXISTS "accounty_ev_records_vehicle_log_insert" ON public.accounty_ev_records_vehicle_log;
DROP POLICY IF EXISTS "accounty_ev_records_vehicle_log_update" ON public.accounty_ev_records_vehicle_log;
DROP POLICY IF EXISTS "accounty_ev_records_vehicle_log_delete" ON public.accounty_ev_records_vehicle_log;
CREATE POLICY "accounty_ev_records_vehicle_log_insert" ON public.accounty_ev_records_vehicle_log FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_vehicle_log_update" ON public.accounty_ev_records_vehicle_log FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_vehicle_log_delete" ON public.accounty_ev_records_vehicle_log FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_records_wages
DROP POLICY IF EXISTS "accounty_ev_records_wages_modify" ON public.accounty_ev_records_wages;
DROP POLICY IF EXISTS "accounty_ev_records_wages_insert" ON public.accounty_ev_records_wages;
DROP POLICY IF EXISTS "accounty_ev_records_wages_update" ON public.accounty_ev_records_wages;
DROP POLICY IF EXISTS "accounty_ev_records_wages_delete" ON public.accounty_ev_records_wages;
CREATE POLICY "accounty_ev_records_wages_insert" ON public.accounty_ev_records_wages FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_wages_update" ON public.accounty_ev_records_wages FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_wages_delete" ON public.accounty_ev_records_wages FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_ev_vat_returns
DROP POLICY IF EXISTS "accounty_ev_vat_returns_modify" ON public.accounty_ev_vat_returns;
DROP POLICY IF EXISTS "accounty_ev_vat_returns_insert" ON public.accounty_ev_vat_returns;
DROP POLICY IF EXISTS "accounty_ev_vat_returns_update" ON public.accounty_ev_vat_returns;
DROP POLICY IF EXISTS "accounty_ev_vat_returns_delete" ON public.accounty_ev_vat_returns;
CREATE POLICY "accounty_ev_vat_returns_insert" ON public.accounty_ev_vat_returns FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_vat_returns_update" ON public.accounty_ev_vat_returns FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_vat_returns_delete" ON public.accounty_ev_vat_returns FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_org_report_lines
DROP POLICY IF EXISTS "accounty_org_report_lines_modify" ON public.accounty_org_report_lines;
DROP POLICY IF EXISTS "accounty_org_report_lines_insert" ON public.accounty_org_report_lines;
DROP POLICY IF EXISTS "accounty_org_report_lines_update" ON public.accounty_org_report_lines;
DROP POLICY IF EXISTS "accounty_org_report_lines_delete" ON public.accounty_org_report_lines;
CREATE POLICY "accounty_org_report_lines_insert" ON public.accounty_org_report_lines FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_org_report_lines_update" ON public.accounty_org_report_lines FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_org_report_lines_delete" ON public.accounty_org_report_lines FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- Table: accounty_penztarkonyv_tetel
DROP POLICY IF EXISTS "accounty_penztarkonyv_tetel_modify" ON public.accounty_penztarkonyv_tetel;
DROP POLICY IF EXISTS "accounty_penztarkonyv_tetel_insert" ON public.accounty_penztarkonyv_tetel;
DROP POLICY IF EXISTS "accounty_penztarkonyv_tetel_update" ON public.accounty_penztarkonyv_tetel;
DROP POLICY IF EXISTS "accounty_penztarkonyv_tetel_delete" ON public.accounty_penztarkonyv_tetel;
CREATE POLICY "accounty_penztarkonyv_tetel_insert" ON public.accounty_penztarkonyv_tetel FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_penztarkonyv_tetel_update" ON public.accounty_penztarkonyv_tetel FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_penztarkonyv_tetel_delete" ON public.accounty_penztarkonyv_tetel FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- ---------------------------------------------------------------------------
-- 2. accounty_tao_yearly: change _modify from ALL to write-only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "accounty_tao_yearly_modify" ON public.accounty_tao_yearly;
DROP POLICY IF EXISTS "accounty_tao_yearly_insert" ON public.accounty_tao_yearly;
DROP POLICY IF EXISTS "accounty_tao_yearly_update" ON public.accounty_tao_yearly;
DROP POLICY IF EXISTS "accounty_tao_yearly_delete" ON public.accounty_tao_yearly;
CREATE POLICY "accounty_tao_yearly_insert" ON public.accounty_tao_yearly FOR INSERT TO authenticated WITH CHECK (((EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = accounty_tao_yearly.company_id AND aa.accountant_user_id = (SELECT auth.uid()))) OR (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = accounty_tao_yearly.company_id AND cm.user_id = (SELECT auth.uid())))));
CREATE POLICY "accounty_tao_yearly_update" ON public.accounty_tao_yearly FOR UPDATE TO authenticated USING (((EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = accounty_tao_yearly.company_id AND aa.accountant_user_id = (SELECT auth.uid()))) OR (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = accounty_tao_yearly.company_id AND cm.user_id = (SELECT auth.uid()))))) WITH CHECK (((EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = accounty_tao_yearly.company_id AND aa.accountant_user_id = (SELECT auth.uid()))) OR (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = accounty_tao_yearly.company_id AND cm.user_id = (SELECT auth.uid())))));
CREATE POLICY "accounty_tao_yearly_delete" ON public.accounty_tao_yearly FOR DELETE TO authenticated USING (((EXISTS (SELECT 1 FROM public.accounty_assignments aa WHERE aa.company_id = accounty_tao_yearly.company_id AND aa.accountant_user_id = (SELECT auth.uid()))) OR (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = accounty_tao_yearly.company_id AND cm.user_id = (SELECT auth.uid())))));

-- ---------------------------------------------------------------------------
-- 3. Cleanup Legacy Duplications across 5 Accounty Tables
-- ---------------------------------------------------------------------------

-- A. accounty_communication_preferences: drop old comm_prefs_*, change modify to write-only
DROP POLICY IF EXISTS "comm_prefs_delete" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "comm_prefs_insert" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "comm_prefs_select" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "comm_prefs_update" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "accounty_communication_preferences_modify" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "accounty_communication_preferences_insert" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "accounty_communication_preferences_update" ON public.accounty_communication_preferences;
DROP POLICY IF EXISTS "accounty_communication_preferences_delete" ON public.accounty_communication_preferences;
CREATE POLICY "accounty_communication_preferences_insert" ON public.accounty_communication_preferences FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_communication_preferences_update" ON public.accounty_communication_preferences FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_communication_preferences_delete" ON public.accounty_communication_preferences FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- B. accounty_deadlines: drop old deadlines_*, change modify to write-only
DROP POLICY IF EXISTS "deadlines_select" ON public.accounty_deadlines;
DROP POLICY IF EXISTS "deadlines_update" ON public.accounty_deadlines;
DROP POLICY IF EXISTS "accounty_deadlines_modify" ON public.accounty_deadlines;
DROP POLICY IF EXISTS "accounty_deadlines_insert" ON public.accounty_deadlines;
DROP POLICY IF EXISTS "accounty_deadlines_update" ON public.accounty_deadlines;
DROP POLICY IF EXISTS "accounty_deadlines_delete" ON public.accounty_deadlines;
CREATE POLICY "accounty_deadlines_insert" ON public.accounty_deadlines FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_deadlines_update" ON public.accounty_deadlines FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_deadlines_delete" ON public.accounty_deadlines FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- C. accounty_missing_items: drop old missing_items_* (auth), change modify to write-only
DROP POLICY IF EXISTS "missing_items_insert" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "missing_items_select" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "missing_items_portal_update_auth" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "missing_items_update" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "accounty_missing_items_modify" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "accounty_missing_items_insert" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "accounty_missing_items_update" ON public.accounty_missing_items;
DROP POLICY IF EXISTS "accounty_missing_items_delete" ON public.accounty_missing_items;
CREATE POLICY "accounty_missing_items_insert" ON public.accounty_missing_items FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_missing_items_update" ON public.accounty_missing_items FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_missing_items_delete" ON public.accounty_missing_items FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));

-- D. accounty_portal_tokens: drop duplicate portal_tokens_* (auth)
DROP POLICY IF EXISTS "portal_tokens_insert" ON public.accounty_portal_tokens;
DROP POLICY IF EXISTS "portal_tokens_select" ON public.accounty_portal_tokens;

-- E. accounty_tax_profiles: drop old tax_profiles_*, change modify to write-only
DROP POLICY IF EXISTS "tax_profiles_insert" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "tax_profiles_select" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "tax_profiles_update" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "accounty_tax_profiles_modify" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "accounty_tax_profiles_insert" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "accounty_tax_profiles_update" ON public.accounty_tax_profiles;
DROP POLICY IF EXISTS "accounty_tax_profiles_delete" ON public.accounty_tax_profiles;
CREATE POLICY "accounty_tax_profiles_insert" ON public.accounty_tax_profiles FOR INSERT TO authenticated WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_tax_profiles_update" ON public.accounty_tax_profiles FOR UPDATE TO authenticated USING (has_accounty_company_access(company_id)) WITH CHECK (has_accounty_company_access(company_id));
CREATE POLICY "accounty_tax_profiles_delete" ON public.accounty_tax_profiles FOR DELETE TO authenticated USING (has_accounty_company_access(company_id));
