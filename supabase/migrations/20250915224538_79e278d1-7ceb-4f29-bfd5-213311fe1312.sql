-- Drop the existing invoices table to recreate it with Hungarian column names
DROP TABLE IF EXISTS public.invoices CASCADE;

-- Create the invoices table with original Hungarian column names from CSV
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  
  -- Original Hungarian column names from CSV
  szamlaszam TEXT NOT NULL,
  kibocsatas_datuma DATE NOT NULL,
  elado_vat_id TEXT,
  elado_nev TEXT NOT NULL,
  elado_cim TEXT,
  vevo_nev TEXT NOT NULL,
  vevo_cim TEXT,
  vevo_vat_id TEXT,
  teljesites_datuma DATE,
  adoalap_osszesen DECIMAL(12,2) NOT NULL DEFAULT 0,
  afa_kulcsok_bontasban TEXT,
  afa_osszeg_osszesen DECIMAL(12,2) NOT NULL DEFAULT 0,
  brutto_vegosszeg DECIMAL(12,2) NOT NULL DEFAULT 0,
  forditott_adozas BOOLEAN DEFAULT false,
  adomentesseg_hivatkozas TEXT,
  onszamlazas BOOLEAN DEFAULT false,
  penzforgalmi_elszamolas BOOLEAN DEFAULT false,
  
  -- Additional system fields
  penznem TEXT DEFAULT 'HUF',
  statusz TEXT DEFAULT 'feldolgozas_alatt' CHECK (statusz IN ('feldolgozas_alatt', 'feldolgozott', 'kifizetve', 'keses', 'torolt')),
  melleklet_url TEXT,
  email_uzenet_id TEXT,
  feldolgozva TIMESTAMP WITH TIME ZONE,
  letrehozva TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  frissitve TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, szamlaszam)
);

-- Enable Row Level Security
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "A felhasználók megtekinthetik saját számláikat" 
ON public.invoices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "A felhasználók létrehozhatják saját számláikat" 
ON public.invoices 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "A felhasználók frissíthetik saját számláikat" 
ON public.invoices 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "A felhasználók törölhetik saját számláikat" 
ON public.invoices 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_invoices_frissitve
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX idx_invoices_kibocsatas_datuma ON public.invoices(kibocsatas_datuma);
CREATE INDEX idx_invoices_statusz ON public.invoices(statusz);
CREATE INDEX idx_invoices_szamlaszam ON public.invoices(szamlaszam);

-- Insert sample data with Hungarian column names
INSERT INTO public.invoices (
  user_id,
  szamlaszam,
  kibocsatas_datuma,
  elado_vat_id,
  elado_nev,
  elado_cim,
  vevo_nev,
  vevo_cim,
  vevo_vat_id,
  teljesites_datuma,
  adoalap_osszesen,
  afa_kulcsok_bontasban,
  afa_osszeg_osszesen,
  brutto_vegosszeg,
  forditott_adozas,
  adomentesseg_hivatkozas,
  onszamlazas,
  penzforgalmi_elszamolas
) VALUES 
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'AAA-2025-15',
  '2025-08-05',
  'HU73185581',
  'KOÓS ZSUZSANNA',
  'Magyarország 1082 BUDAPEST, FUTÓ utca 16. FSZ. em. 1.',
  'BUSINESS CLASS EDUCATION CENTRE SZOLGÁLTATÓ KORLÁTOLT FELELŐSSÉGŰ TÁRSASÁG',
  'Magyarország 3532 MISKOLC, GYÓRI KAPU 69. 1. em. 2.',
  'HU13996828',
  '2025-08-20',
  136800,
  '0',
  0,
  136800,
  false,
  'Alanyi adómentes, SZJ: 8559, Adómentesség leírása: Alanyi adómentes',
  false,
  false
),
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'BOSZE-2025-39',
  '2025-08-04',
  'HU60258900',
  'Bősze Márta Zlta',
  '1039 Budapest, Sarkadi Imre utca 2.',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16. FSZ. 1. üzlet',
  'HU13996828',
  '2025-08-18',
  300325,
  '0',
  0,
  300325,
  false,
  'AAM',
  false,
  false
),
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89',
  'C20253232',
  '2025-08-08',
  'HU26769978',
  'GSZ-Monument Kft.',
  '1133 Budapest, Váci út 110.',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16. fszt.',
  'HU13996828',
  '2025-08-08',
  23622,
  '0',
  6378,
  30000,
  false,
  '',
  false,
  false
);