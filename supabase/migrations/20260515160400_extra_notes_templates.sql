-- ============================================
-- Additional seed templates for Kiegészítő Melléklet
-- Adds: environment, R&D, related parties, financial ratios, closing resolution
-- ============================================

-- Bump order_num of existing sections to make room
UPDATE public.annual_report_notes_templates SET order_num = order_num + 5 WHERE order_num >= 9;

INSERT INTO public.annual_report_notes_templates (section_key, section_title, default_text, order_num, is_required, category) VALUES
(
  'company_presentation',
  'I/A. A vállalkozás bemutatása',
  E'A [Cégnév] (székhely: [Székhely], adószám: [Adószám]) a tárgyévben folyamatosan működő vállalkozásként tevékenykedett.\n\nA társaság képviseletére és a beszámoló aláírására jogosult személy: [Képviselő neve] ([Képviselő beosztása]).\n\nA társaság a Számviteli törvény előírásainak megfelelően kettős könyvvitelt vezet. A beszámoló formája: Egyszerűsített Éves Beszámoló. A beszámoló elkészítése a magyar számviteli előírások alapján, ezer forintban (E Ft) történik.',
  0, true, 'general_info'
),
(
  'materiality_threshold',
  'II/A. Lényegességi küszöb és hibadefiníció',
  E'A számviteli politika értelmében jelentős összegű a hiba, ha a hiba feltárásának évében az ellenőrzések során megállapított hibák és hibahatások együttes értéke meghaladja a vizsgált üzleti év mérlegfőösszegének 2 százalékát, vagy ha a mérlegfőösszeg 2 százaléka nem haladja meg az 1 millió forintot, akkor az 1 millió forintot.\n\nA vállalkozás mérlegfordulónapja: [Tárgyév]. december 31. A mérlegkészítés időpontja: [Tárgyév+1]. május 31.',
  3, true, 'valuation'
),
(
  'fx_valuation',
  'III/A. Devizás tételek értékelése',
  E'A külföldi pénzértékre szóló eszközöket és kötelezettségeket a társaság a bekerülés napjára vonatkozó MNB hivatalos devizaárfolyamon értékeli. Az év végi átértékelés az MNB [Tárgyév]. december 31-i hivatalos árfolyamán történik.',
  5, false, 'valuation'
),
(
  'environment',
  'IX. Környezetvédelmi nyilatkozat',
  E'A vállalkozásnak a tárgyévben környezetvédelemmel kapcsolatos beruházása, költsége nem volt. Környezetvédelmi kötelezettség a társaságot nem terheli.',
  9, false, 'other'
),
(
  'research_development',
  'X. Kutatás-fejlesztési tevékenység',
  E'A társaság a tárgyévben kutatás-fejlesztési tevékenységet nem végzett, ilyen címen költséget nem számolt el.',
  10, false, 'other'
),
(
  'related_parties',
  'XI. Kapcsolt vállalkozásokkal való ügyletek',
  E'A társaságnak kapcsolt vállalkozása nincs, ilyen irányú tranzakciók a tárgyévben nem történtek.',
  11, false, 'other'
),
(
  'contingent_liabilities',
  'XII. Függő és biztos jövőbeni kötelezettségek',
  E'A társaságnak a mérlegben nem szereplő, de a jövőbeni pénzügyi helyzetet jelentősen befolyásoló kötelezettsége (kezességvállalás, folyamatban lévő per, stb.) nincs.',
  12, false, 'other'
),
(
  'financial_ratios',
  'XIII. Vagyoni és eredményhelyzet értékelése',
  E'A társaság saját tőkéje a tárgyévben [Saját tőke változás] az előző évhez képest.\n\nFőbb pénzügyi mutatók:\n- Saját tőke: [Saját tőke] E Ft\n- Mérlegfőösszeg: [Mérlegfőösszeg] E Ft\n- Tőkearányos jövedelmezőség: [ROE]%\n- Likviditási mutató: [Likviditás]\n\nA rövid lejáratú kötelezettségeit a forgóeszközök [Likviditás értékelés].',
  13, true, 'other'
),
(
  'closing_resolution',
  'XIV. Záró határozat — Adózott eredmény felhasználása',
  E'A társaság ügyvezetése javasolja a taggyűlésnek, hogy a tárgyévi [Adózott eredmény] E Ft adózott eredményből [Osztalék] E Ft kerüljön kifizetésre osztalékként, míg a fennmaradó [Eredménytartalék] E Ft az eredménytartalékba kerüljön áthelyezésre.',
  14, true, 'other'
)
ON CONFLICT (section_key) DO NOTHING;
