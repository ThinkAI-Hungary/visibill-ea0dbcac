-- =============================================
-- BALANCE SHEET - Seed: Sztv. "A" változat
-- UUID scheme: 00000000-0000-0000-0001-XXXXXXXXXXXX
-- =============================================

INSERT INTO public.bs_structure (id, row_code, name, section, type, parent_id, order_num, is_pnl_bridge) VALUES
-- ===== ESZKÖZÖK (AKTÍVÁK) =====
('00000000-0000-0000-0001-000000000999', '', 'ESZKÖZÖK (AKTÍVÁK) ÖSSZESEN', 'assets', 'total', NULL, 9999, false),

-- A. Befektetett eszközök
('00000000-0000-0000-0001-000000000100', 'A.', 'Befektetett eszközök', 'assets', 'letter', '00000000-0000-0000-0001-000000000999', 100, false),
('00000000-0000-0000-0001-000000000110', 'I.', 'IMMATERIÁLIS JAVAK', 'assets', 'roman', '00000000-0000-0000-0001-000000000100', 110, false),
('00000000-0000-0000-0001-000000000111', '1.', 'Alapítás-átszervezés aktivált értéke', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 111, false),
('00000000-0000-0000-0001-000000000112', '2.', 'Kísérleti fejlesztés aktivált értéke', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 112, false),
('00000000-0000-0000-0001-000000000113', '3.', 'Vagyoni értékű jogok', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 113, false),
('00000000-0000-0000-0001-000000000114', '4.', 'Szellemi termékek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 114, false),
('00000000-0000-0000-0001-000000000115', '5.', 'Üzleti vagy cégérték', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 115, false),
('00000000-0000-0000-0001-000000000116', '6.', 'Immateriális javakra adott előlegek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 116, false),
('00000000-0000-0000-0001-000000000117', '7.', 'Immateriális javak értékhelyesbítése', 'assets', 'arabic', '00000000-0000-0000-0001-000000000110', 117, false),

('00000000-0000-0000-0001-000000000120', 'II.', 'TÁRGYI ESZKÖZÖK', 'assets', 'roman', '00000000-0000-0000-0001-000000000100', 120, false),
('00000000-0000-0000-0001-000000000121', '1.', 'Ingatlanok és a kapcsolódó vagyoni értékű jogok', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 121, false),
('00000000-0000-0000-0001-000000000122', '2.', 'Műszaki berendezések, gépek, járművek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 122, false),
('00000000-0000-0000-0001-000000000123', '3.', 'Egyéb berendezések, felszerelések, járművek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 123, false),
('00000000-0000-0000-0001-000000000124', '4.', 'Tenyészállatok', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 124, false),
('00000000-0000-0000-0001-000000000125', '5.', 'Beruházások, felújítások', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 125, false),
('00000000-0000-0000-0001-000000000126', '6.', 'Beruházásokra adott előlegek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 126, false),
('00000000-0000-0000-0001-000000000127', '7.', 'Tárgyi eszközök értékhelyesbítése', 'assets', 'arabic', '00000000-0000-0000-0001-000000000120', 127, false),

('00000000-0000-0000-0001-000000000130', 'III.', 'BEFEKTETETT PÉNZÜGYI ESZKÖZÖK', 'assets', 'roman', '00000000-0000-0000-0001-000000000100', 130, false),
('00000000-0000-0000-0001-000000000131', '1.', 'Tartós részesedés kapcsolt vállalkozásban', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 131, false),
('00000000-0000-0000-0001-000000000132', '2.', 'Tartósan adott kölcsön kapcsolt vállalkozásban', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 132, false),
('00000000-0000-0000-0001-000000000133', '3.', 'Egyéb tartós részesedés', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 133, false),
('00000000-0000-0000-0001-000000000134', '4.', 'Tartósan adott kölcsön egyéb részesedési viszonyban álló vállalkozásban', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 134, false),
('00000000-0000-0000-0001-000000000135', '5.', 'Egyéb tartósan adott kölcsön', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 135, false),
('00000000-0000-0000-0001-000000000136', '6.', 'Tartós hitelviszonyt megtestesítő értékpapír', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 136, false),
('00000000-0000-0000-0001-000000000137', '7.', 'Befektetett pénzügyi eszközök értékhelyesbítése', 'assets', 'arabic', '00000000-0000-0000-0001-000000000130', 137, false),

-- B. Forgóeszközök
('00000000-0000-0000-0001-000000000200', 'B.', 'Forgóeszközök', 'assets', 'letter', '00000000-0000-0000-0001-000000000999', 200, false),
('00000000-0000-0000-0001-000000000210', 'I.', 'KÉSZLETEK', 'assets', 'roman', '00000000-0000-0000-0001-000000000200', 210, false),
('00000000-0000-0000-0001-000000000211', '1.', 'Anyagok', 'assets', 'arabic', '00000000-0000-0000-0001-000000000210', 211, false),
('00000000-0000-0000-0001-000000000212', '2.', 'Befejezetlen termelés és félkész termékek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000210', 212, false),
('00000000-0000-0000-0001-000000000213', '3.', 'Növendék-, hízó- és egyéb állatok', 'assets', 'arabic', '00000000-0000-0000-0001-000000000210', 213, false),
('00000000-0000-0000-0001-000000000214', '4.', 'Késztermékek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000210', 214, false),
('00000000-0000-0000-0001-000000000215', '5.', 'Áruk', 'assets', 'arabic', '00000000-0000-0000-0001-000000000210', 215, false),
('00000000-0000-0000-0001-000000000216', '6.', 'Készletekre adott előlegek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000210', 216, false),

('00000000-0000-0000-0001-000000000220', 'II.', 'KÖVETELÉSEK', 'assets', 'roman', '00000000-0000-0000-0001-000000000200', 220, false),
('00000000-0000-0000-0001-000000000221', '1.', 'Követelések áruszállításból és szolgáltatásból (vevők)', 'assets', 'arabic', '00000000-0000-0000-0001-000000000220', 221, false),
('00000000-0000-0000-0001-000000000222', '2.', 'Követelések kapcsolt vállalkozással szemben', 'assets', 'arabic', '00000000-0000-0000-0001-000000000220', 222, false),
('00000000-0000-0000-0001-000000000223', '3.', 'Követelések egyéb részesedési viszonyban lévő vállalkozással szemben', 'assets', 'arabic', '00000000-0000-0000-0001-000000000220', 223, false),
('00000000-0000-0000-0001-000000000224', '4.', 'Váltókövetelések', 'assets', 'arabic', '00000000-0000-0000-0001-000000000220', 224, false),
('00000000-0000-0000-0001-000000000225', '5.', 'Egyéb követelések', 'assets', 'arabic', '00000000-0000-0000-0001-000000000220', 225, false),
('00000000-0000-0000-0001-000000000226', '6.', 'Követelések értékhelyesbítése', 'assets', 'arabic', '00000000-0000-0000-0001-000000000220', 226, false),

('00000000-0000-0000-0001-000000000230', 'III.', 'ÉRTÉKPAPÍROK', 'assets', 'roman', '00000000-0000-0000-0001-000000000200', 230, false),
('00000000-0000-0000-0001-000000000231', '1.', 'Részesedés kapcsolt vállalkozásban', 'assets', 'arabic', '00000000-0000-0000-0001-000000000230', 231, false),
('00000000-0000-0000-0001-000000000232', '2.', 'Egyéb részesedés', 'assets', 'arabic', '00000000-0000-0000-0001-000000000230', 232, false),
('00000000-0000-0000-0001-000000000233', '3.', 'Saját részvények, saját üzletrészek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000230', 233, false),
('00000000-0000-0000-0001-000000000234', '4.', 'Forgatási célú hitelviszonyt megtestesítő értékpapírok', 'assets', 'arabic', '00000000-0000-0000-0001-000000000230', 234, false),
('00000000-0000-0000-0001-000000000235', '5.', 'Értékpapírok értékhelyesbítése', 'assets', 'arabic', '00000000-0000-0000-0001-000000000230', 235, false),

('00000000-0000-0000-0001-000000000240', 'IV.', 'PÉNZESZKÖZÖK', 'assets', 'roman', '00000000-0000-0000-0001-000000000200', 240, false),
('00000000-0000-0000-0001-000000000241', '1.', 'Pénztár, csekkek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000240', 241, false),
('00000000-0000-0000-0001-000000000242', '2.', 'Bankbetétek', 'assets', 'arabic', '00000000-0000-0000-0001-000000000240', 242, false),

-- C. Aktív időbeli elhatárolások
('00000000-0000-0000-0001-000000000300', 'C.', 'Aktív időbeli elhatárolások', 'assets', 'letter', '00000000-0000-0000-0001-000000000999', 300, false),
('00000000-0000-0000-0001-000000000301', '1.', 'Bevételek aktív időbeli elhatárolása', 'assets', 'arabic', '00000000-0000-0000-0001-000000000300', 301, false),
('00000000-0000-0000-0001-000000000302', '2.', 'Költségek, ráfordítások aktív időbeli elhatárolása', 'assets', 'arabic', '00000000-0000-0000-0001-000000000300', 302, false),
('00000000-0000-0000-0001-000000000303', '3.', 'Halasztott ráfordítások', 'assets', 'arabic', '00000000-0000-0000-0001-000000000300', 303, false),

-- ===== FORRÁSOK (PASSZÍVÁK) =====
('00000000-0000-0000-0001-000000001999', '', 'FORRÁSOK (PASSZÍVÁK) ÖSSZESEN', 'liabilities', 'total', NULL, 19999, false),

-- D. Saját tőke
('00000000-0000-0000-0001-000000001100', 'D.', 'Saját tőke', 'liabilities', 'letter', '00000000-0000-0000-0001-000000001999', 1100, false),
('00000000-0000-0000-0001-000000001110', 'I.', 'JEGYZETT TŐKE', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1110, false),
('00000000-0000-0000-0001-000000001120', 'II.', 'JEGYZETT, DE MÉG BE NEM FIZETETT TŐKE (-)', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1120, false),
('00000000-0000-0000-0001-000000001130', 'III.', 'TŐKETARTALÉK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1130, false),
('00000000-0000-0000-0001-000000001140', 'IV.', 'EREDMÉNYTARTALÉK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1140, false),
('00000000-0000-0000-0001-000000001150', 'V.', 'LEKÖTÖTT TARTALÉK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1150, false),
('00000000-0000-0000-0001-000000001160', 'VI.', 'ÉRTÉKELÉSI TARTALÉK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1160, false),
('00000000-0000-0000-0001-000000001170', 'VII.', 'MÉRLEG SZERINTI EREDMÉNY', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001100', 1170, true),

-- E. Céltartalékok
('00000000-0000-0000-0001-000000001200', 'E.', 'Céltartalékok', 'liabilities', 'letter', '00000000-0000-0000-0001-000000001999', 1200, false),
('00000000-0000-0000-0001-000000001201', '1.', 'Céltartalék a várható kötelezettségekre', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001200', 1201, false),
('00000000-0000-0000-0001-000000001202', '2.', 'Céltartalék a jövőbeni költségekre', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001200', 1202, false),
('00000000-0000-0000-0001-000000001203', '3.', 'Egyéb céltartalék', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001200', 1203, false),

-- F. Kötelezettségek
('00000000-0000-0000-0001-000000001300', 'F.', 'Kötelezettségek', 'liabilities', 'letter', '00000000-0000-0000-0001-000000001999', 1300, false),
('00000000-0000-0000-0001-000000001310', 'I.', 'HÁTRASOROLT KÖTELEZETTSÉGEK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001300', 1310, false),
('00000000-0000-0000-0001-000000001311', '1.', 'Hátrasorolt kötelezettségek kapcsolt vállalkozással szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001310', 1311, false),
('00000000-0000-0000-0001-000000001312', '2.', 'Hátrasorolt kötelezettségek egyéb részesedési viszonyban lévő vállalkozással szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001310', 1312, false),
('00000000-0000-0000-0001-000000001313', '3.', 'Hátrasorolt kötelezettségek egyéb gazdálkodóval szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001310', 1313, false),

('00000000-0000-0000-0001-000000001320', 'II.', 'HOSSZÚ LEJÁRATÚ KÖTELEZETTSÉGEK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001300', 1320, false),
('00000000-0000-0000-0001-000000001321', '1.', 'Hosszú lejáratra kapott kölcsönök', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1321, false),
('00000000-0000-0000-0001-000000001322', '2.', 'Átváltoztatható kötvények', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1322, false),
('00000000-0000-0000-0001-000000001323', '3.', 'Tartozások kötvénykibocsátásból', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1323, false),
('00000000-0000-0000-0001-000000001324', '4.', 'Beruházási és fejlesztési hitelek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1324, false),
('00000000-0000-0000-0001-000000001325', '5.', 'Egyéb hosszú lejáratú hitelek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1325, false),
('00000000-0000-0000-0001-000000001326', '6.', 'Tartós kötelezettségek kapcsolt vállalkozással szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1326, false),
('00000000-0000-0000-0001-000000001327', '7.', 'Tartós kötelezettségek egyéb részesedési viszonyban lévő vállalkozással szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1327, false),
('00000000-0000-0000-0001-000000001328', '8.', 'Egyéb hosszú lejáratú kötelezettségek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001320', 1328, false),

('00000000-0000-0000-0001-000000001330', 'III.', 'RÖVID LEJÁRATÚ KÖTELEZETTSÉGEK', 'liabilities', 'roman', '00000000-0000-0000-0001-000000001300', 1330, false),
('00000000-0000-0000-0001-000000001331', '1.', 'Rövid lejáratú kölcsönök', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1331, false),
('00000000-0000-0000-0001-000000001332', '2.', 'Rövid lejáratú hitelek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1332, false),
('00000000-0000-0000-0001-000000001333', '3.', 'Vevőktől kapott előlegek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1333, false),
('00000000-0000-0000-0001-000000001334', '4.', 'Kötelezettségek áruszállításból és szolgáltatásból (szállítók)', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1334, false),
('00000000-0000-0000-0001-000000001335', '5.', 'Váltótartozások', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1335, false),
('00000000-0000-0000-0001-000000001336', '6.', 'Rövid lejáratú kötelezettségek kapcsolt vállalkozással szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1336, false),
('00000000-0000-0000-0001-000000001337', '7.', 'Rövid lejáratú kötelezettségek egyéb részesedési viszonyban lévő vállalkozással szemben', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1337, false),
('00000000-0000-0000-0001-000000001338', '8.', 'Egyéb rövid lejáratú kötelezettségek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001330', 1338, false),

-- G. Passzív időbeli elhatárolások
('00000000-0000-0000-0001-000000001400', 'G.', 'Passzív időbeli elhatárolások', 'liabilities', 'letter', '00000000-0000-0000-0001-000000001999', 1400, false),
('00000000-0000-0000-0001-000000001401', '1.', 'Bevételek passzív időbeli elhatárolása', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001400', 1401, false),
('00000000-0000-0000-0001-000000001402', '2.', 'Költségek, ráfordítások passzív időbeli elhatárolása', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001400', 1402, false),
('00000000-0000-0000-0001-000000001403', '3.', 'Halasztott bevételek', 'liabilities', 'arabic', '00000000-0000-0000-0001-000000001400', 1403, false)

ON CONFLICT (id) DO NOTHING;
