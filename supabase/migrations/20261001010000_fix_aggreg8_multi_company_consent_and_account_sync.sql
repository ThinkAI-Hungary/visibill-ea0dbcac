-- Migration: 20261001010000_fix_aggreg8_multi_company_consent_and_account_sync.sql
-- Description: Enyhíti az aggreg8_consents táblán lévő egyedi megszorítást,
-- hogy ugyanaz a banki felhatalmazás (info_sharing_consent_id) több céghez is csatolható legyen (multi-company support),
-- miközben cégenként garantálja az egyediséget.

ALTER TABLE public.aggreg8_consents DROP CONSTRAINT IF EXISTS aggreg8_consents_info_sharing_consent_id_key;
ALTER TABLE public.aggreg8_consents ADD CONSTRAINT aggreg8_consents_company_info_sharing_key UNIQUE (company_id, info_sharing_consent_id);

-- Indexek a gyors multi-tenant kereséshez
CREATE INDEX IF NOT EXISTS idx_aggreg8_consents_company_info_sharing ON public.aggreg8_consents(company_id, info_sharing_consent_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_accounts_company_consent ON public.aggreg8_accounts(company_id, consent_id);
