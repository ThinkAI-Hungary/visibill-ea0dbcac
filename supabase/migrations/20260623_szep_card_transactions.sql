-- SZÉP Kártya (Széchenyi Pihenőkártya) elfogadóhelyi tranzakciók
-- Külön tábla a speciális oszlopok (jutalék, alszámla, kártyatulajdonos stb.) miatt

CREATE TABLE IF NOT EXISTS public.szep_card_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  upload_id         uuid REFERENCES transaction_uploads(id) ON DELETE SET NULL,

  -- Alap tranzakciós adatok
  transaction_date  date NOT NULL,
  gross_amount      numeric NOT NULL,            -- Összeg (bruttó, amit a vendég fizetett)
  commission_amount numeric NOT NULL DEFAULT 0,  -- Jutalék összeg
  commission_vat    numeric NOT NULL DEFAULT 0,  -- Jutalék ÁFA
  net_amount        numeric NOT NULL,            -- Utalandó összeg (bruttó - jutalék)
  currency          text NOT NULL DEFAULT 'HUF',

  -- SZÉP specifikus
  merchant_name     text,                        -- Elfogadóhely megnevezése
  sub_account       text NOT NULL,               -- Szálláshely / Vendéglátás / Szabadidő
  card_number_masked text,                       -- **** **** **** 4175
  card_holder       text,                        -- Kártyatulajdonos neve
  issuer_bank       text,                        -- Kibocsátó bank (OTP, K&H, MBH)

  -- POS / tranzakció azonosítók
  pos_terminal_id   text,
  approval_code     text,
  transaction_ref   text,
  is_webshop        boolean NOT NULL DEFAULT false,

  -- Utalás adatok
  transfer_reference text,                       -- Utalás bizonylatszám
  transfer_date     date,                        -- Utalás dátum
  bank_account      text,                        -- Számlaszám

  -- Státusz
  status            text NOT NULL DEFAULT 'Sikeres',
  is_reversal       boolean NOT NULL DEFAULT false,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Trigger for updated_at
CREATE TRIGGER set_szep_updated_at
  BEFORE UPDATE ON public.szep_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_szep_company_date ON public.szep_card_transactions(company_id, transaction_date DESC);
CREATE INDEX idx_szep_sub_account ON public.szep_card_transactions(company_id, sub_account);
CREATE INDEX idx_szep_upload ON public.szep_card_transactions(upload_id);
CREATE INDEX idx_szep_issuer_bank ON public.szep_card_transactions(issuer_bank);

-- RLS
ALTER TABLE public.szep_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view szep transactions"
  ON public.szep_card_transactions FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can insert szep transactions"
  ON public.szep_card_transactions FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update szep transactions"
  ON public.szep_card_transactions FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete szep transactions"
  ON public.szep_card_transactions FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
  ));

-- Unique constraint: prevent duplicate imports (same date + approval_code + company)
CREATE UNIQUE INDEX idx_szep_unique_transaction
  ON public.szep_card_transactions(company_id, transaction_date, approval_code)
  WHERE approval_code IS NOT NULL;
