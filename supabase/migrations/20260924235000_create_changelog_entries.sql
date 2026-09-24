-- Migration: Create changelog_entries table and RLS policies
-- Date: 2026-09-24

CREATE TABLE IF NOT EXISTS public.changelog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  release_date date NOT NULL DEFAULT current_date,
  title text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL DEFAULT 'feature',
  app_scope text NOT NULL DEFAULT 'all',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_changelog_entries_release_date ON public.changelog_entries(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_published ON public.changelog_entries(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_changelog_entries_category ON public.changelog_entries(category);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_app_scope ON public.changelog_entries(app_scope);

-- RLS
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Authenticated users can view published entries; admins can view all
CREATE POLICY "Anyone can view published changelog entries"
ON public.changelog_entries
FOR SELECT
TO authenticated
USING (
  is_published = true
  OR public.is_support_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('management', 'thinkai')
  )
);

-- 2. INSERT: Only support admin or management
CREATE POLICY "Admins can insert changelog entries"
ON public.changelog_entries
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_support_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('management', 'thinkai')
  )
);

-- 3. UPDATE: Only support admin or management
CREATE POLICY "Admins can update changelog entries"
ON public.changelog_entries
FOR UPDATE
TO authenticated
USING (
  public.is_support_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('management', 'thinkai')
  )
)
WITH CHECK (
  public.is_support_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('management', 'thinkai')
  )
);

-- 4. DELETE: Only support admin or management
CREATE POLICY "Admins can delete changelog entries"
ON public.changelog_entries
FOR DELETE
TO authenticated
USING (
  public.is_support_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role IN ('management', 'thinkai')
  )
);

-- Seed initial real patchnotes
INSERT INTO public.changelog_entries (version, release_date, title, summary, category, app_scope, items, is_published)
VALUES 
(
  'v2.2.5',
  '2026-09-24',
  'Könyvelőirodai hibajegy megosztás és szakmai kategóriák',
  'Megkönnyítettük a könyvelőirodák csapatmunkáját: az azonos irodához tartozó kollégák mostantól közösen látják az ügyfélcégek hibajegyeit, és 37 előre definiált kategória segíti a bejelentések rendszerezését.',
  'feature',
  'all',
  '[
    {"type": "new", "title": "Közös irodai hozzáférés", "description": "Az iroda tagjai látják egymás jegyeit a kezelt cégeknél, és jóváhagyhatják a megoldást."},
    {"type": "new", "title": "37 Szakmai kategória", "description": "Gyors combobox választó számlákhoz, főkönyvhöz, bankhoz és bérhez."},
    {"type": "perf", "title": "Azonnali Cégkereső mező", "description": "Keresősáv a fejlécben, amellyel egyetlen gépeléssel leszűrhető a több tucat kezelt ügyfélcég."},
    {"type": "fix", "title": "Kollégális értesítési adatvédelem", "description": "A másnak küldött support válaszok nem csinálnak felesleges olvasatlan badge-et a társaidnál."}
  ]'::jsonb,
  true
),
(
  'v2.2.4',
  '2026-09-23',
  'Aggreg8 PSD2 Open Banking integráció & Devizás számlakarton',
  'Élesítettük az automatizált banki tranzakció-letöltést, valamint a főkönyvben mostantól devizanemenként (EUR, USD, HUF) is vizsgálhatók a partneri számlaegyenlegek.',
  'improvement',
  'all',
  '[
    {"type": "new", "title": "Automatikus banki szinkron", "description": "10 000+ banksor gyors lapozása és intelligens AI párosítása a számlákkal."},
    {"type": "perf", "title": "Napi MNB devizaárfolyam", "description": "Automatikus árfolyam-számítás és valós idejű devizás karton nézet."}
  ]'::jsonb,
  true
),
(
  'v2.2.3',
  '2026-09-22',
  'NAV 2665 ÁFA bevallás és 65M összesítő jelentés',
  'Finomhangoltuk a 6/B acélipari nyilatkozat sorait és a szabványos ÁNYK XML exportot a legújabb jogszabályi specifikációknak megfelelően.',
  'fix',
  'eaisybooks',
  '[
    {"type": "fix", "title": "Szabványos ÁNYK export", "description": "Egykattintásos XML generálás kézi adatmásolás és korrekció nélkül."},
    {"type": "fix", "title": "Acélipari 6/B nyilatkozat", "description": "Egész kilogrammos kerekítési garancia a hivatalos ellenőrző szabályoknak megfelelően."}
  ]'::jsonb,
  true
);
