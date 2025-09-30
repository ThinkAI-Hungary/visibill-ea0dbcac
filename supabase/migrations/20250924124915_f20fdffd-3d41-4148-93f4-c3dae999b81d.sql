-- Create backup table for sima_szamla
CREATE TABLE public.sima_szamla_backup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  szamlaszam text NOT NULL,
  kibocsatas_datuma date NOT NULL,
  elado_vat_id text,
  elado_nev text NOT NULL,
  elado_cim text,
  vevo_nev text NOT NULL,
  vevo_cim text,
  vevo_vat_id text,
  teljesites_datuma date,
  adoalap_osszesen numeric DEFAULT 0,
  afa_kulcsok_bontasban text,
  afa_osszeg_osszesen numeric DEFAULT 0,
  brutto_vegosszeg numeric DEFAULT 0,
  forditott_adozas boolean DEFAULT false,
  adomentesseg_hivatkozas text,
  onszamlazas boolean DEFAULT false,
  penzforgalmi_elszamolas boolean DEFAULT false,
  penznem text DEFAULT 'HUF',
  statusz text DEFAULT 'feldolgozas_alatt',
  project_id uuid,
  melleklet_url text,
  email_uzenet_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create backup table for vegszamla
CREATE TABLE public.vegszamla_backup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  szamlaszam text NOT NULL,
  kibocsatas_datuma date NOT NULL,
  elado_vat_id text,
  elado_nev text NOT NULL,
  elado_cim text,
  vevo_nev text NOT NULL,
  vevo_cim text,
  adoalap_osszesen numeric DEFAULT 0,
  afa_osszeg_osszesen numeric DEFAULT 0,
  elolegszamla_hivatkozas text,
  elszamolt_eloleg_osszeg numeric,
  brutto_vegosszeg numeric DEFAULT 0,
  teljesites_datuma date,
  forditott_adozas boolean DEFAULT false,
  project_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create backup table for proforma
CREATE TABLE public.proforma_backup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  dokumentum_azonosito text,
  kibocsatas_datuma date NOT NULL,
  elado_vat_id text,
  fizetendo_osszeg numeric,
  fizetesi_mod text,
  vevo_nev text NOT NULL,
  elado_nev text NOT NULL,
  bankszamlaszam_iban text,
  adojogi_megjegyzes text,
  fizetesi_hatarido date,
  project_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create backup table for egyszerusitett_szamla
CREATE TABLE public.egyszerusitett_szamla_backup (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  elado_vat_id text,
  kibocsatas_datuma date NOT NULL,
  termek_szolgaltatas_tipusa text,
  afa_osszeg numeric,
  adoalap_osszesen_netto numeric,
  elado_cim text,
  vevo_nev text NOT NULL,
  elado_nev text NOT NULL,
  project_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on backup tables
ALTER TABLE public.sima_szamla_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vegszamla_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egyszerusitett_szamla_backup ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sima_szamla_backup
CREATE POLICY "Users can view their own sima_szamla backup" 
ON public.sima_szamla_backup 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sima_szamla backup" 
ON public.sima_szamla_backup 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sima_szamla backup" 
ON public.sima_szamla_backup 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sima_szamla backup" 
ON public.sima_szamla_backup 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for vegszamla_backup
CREATE POLICY "Users can view their own vegszamla backup" 
ON public.vegszamla_backup 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vegszamla backup" 
ON public.vegszamla_backup 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vegszamla backup" 
ON public.vegszamla_backup 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vegszamla backup" 
ON public.vegszamla_backup 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for proforma_backup
CREATE POLICY "Users can view their own proforma backup" 
ON public.proforma_backup 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own proforma backup" 
ON public.proforma_backup 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own proforma backup" 
ON public.proforma_backup 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own proforma backup" 
ON public.proforma_backup 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for egyszerusitett_szamla_backup
CREATE POLICY "Users can view their own egyszerusitett_szamla backup" 
ON public.egyszerusitett_szamla_backup 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own egyszerusitett_szamla backup" 
ON public.egyszerusitett_szamla_backup 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own egyszerusitett_szamla backup" 
ON public.egyszerusitett_szamla_backup 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own egyszerusitett_szamla backup" 
ON public.egyszerusitett_szamla_backup 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_sima_szamla_backup_user_id ON public.sima_szamla_backup(user_id);
CREATE INDEX idx_vegszamla_backup_user_id ON public.vegszamla_backup(user_id);
CREATE INDEX idx_proforma_backup_user_id ON public.proforma_backup(user_id);
CREATE INDEX idx_egyszerusitett_szamla_backup_user_id ON public.egyszerusitett_szamla_backup(user_id);

CREATE INDEX idx_sima_szamla_backup_date ON public.sima_szamla_backup(kibocsatas_datuma);
CREATE INDEX idx_vegszamla_backup_date ON public.vegszamla_backup(kibocsatas_datuma);
CREATE INDEX idx_proforma_backup_date ON public.proforma_backup(kibocsatas_datuma);
CREATE INDEX idx_egyszerusitett_szamla_backup_date ON public.egyszerusitett_szamla_backup(kibocsatas_datuma);