export interface ClientData {
  id: string;
  name: string;
  taxNumber: string;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  unprocessedCount: number;
  missingCount: number;
  deadline: string;
  deadlineDate: string;  // ISO date for dynamic calculation
  progress: number;      // 0-100, monthly closing progress
  colorHex: string;
  assignedToMe: boolean;
  ownerId: string;
}

export interface Accountant {
  id: string;
  name: string;
  initial: string;
}

export const mockAccountants: Accountant[] = [
  { id: '1', name: 'Anna', initial: 'A' },
  { id: '2', name: 'Péter', initial: 'P' },
  { id: '3', name: 'Gábor', initial: 'G' },
  { id: '4', name: 'Zsuzsa', initial: 'Z' },
];

export const mockKpis = {
  totalClients: 24,
  unprocessedInvoices: 47,
  missingInvoices: 12,
  upcomingDeadlines: 5,
};

export const mockClients: ClientData[] = [
  {
    id: '1',
    name: 'Tech Solutions Kft.',
    taxNumber: '12345678-1-42',
    status: 'Feldolgozandó',
    unprocessedCount: 5,
    missingCount: 2,
    deadline: 'jan. 20.',
    deadlineDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 65,
    colorHex: 'bg-emerald-100 text-emerald-600',
    assignedToMe: true,
    ownerId: '1',
  },
  {
    id: '2',
    name: 'Webshop Hungary Zrt.',
    taxNumber: '87654321-2-41',
    status: 'Kritikus',
    unprocessedCount: 12,
    missingCount: 0,
    deadline: 'jan. 15.',
    deadlineDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 30,
    colorHex: 'bg-amber-100 text-amber-600',
    assignedToMe: false,
    ownerId: '2',
  },
  {
    id: '3',
    name: 'Építő Mesterei Bt.',
    taxNumber: '11223344-1-13',
    status: 'Rendben',
    unprocessedCount: 0,
    missingCount: 0,
    deadline: 'jan. 25.',
    deadlineDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 95,
    colorHex: 'bg-indigo-100 text-indigo-600',
    assignedToMe: true,
    ownerId: '1',
  },
  {
    id: '4',
    name: 'Gastro Delight Kft.',
    taxNumber: '55667788-1-42',
    status: 'Feldolgozandó',
    unprocessedCount: 3,
    missingCount: 1,
    deadline: 'jan. 18.',
    deadlineDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 45,
    colorHex: 'bg-pink-100 text-pink-600',
    assignedToMe: true,
    ownerId: '1',
  },
  {
    id: '5',
    name: 'Green Energy Solutions',
    taxNumber: '99887766-2-43',
    status: 'Kritikus',
    unprocessedCount: 8,
    missingCount: 4,
    deadline: 'jan. 12.',
    deadlineDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    progress: 15,
    colorHex: 'bg-teal-100 text-teal-600',
    assignedToMe: false,
    ownerId: '3',
  },
];

export type InvoiceStatus = 'Új' | 'Kontírozásra vár' | 'Kontírozott' | 'Exportálva' | 'Problémás';

export interface Invoice {
  id: string;
  clientId: string;
  invoiceNumber: string;
  partnerName: string;
  date: string;
  grossAmount: number;
  vatAmount: number;
  status: InvoiceStatus;
  type: 'bejovo' | 'kimeno';
}

export const mockInvoices: Invoice[] = [
  { id: 'inv1', clientId: '1', invoiceNumber: 'INV-2024-001', partnerName: 'Telekom Magyarország', date: '2024. 01. 10.', grossAmount: 125400, vatAmount: 24800, status: 'Új', type: 'bejovo' },
  { id: 'inv2', clientId: '1', invoiceNumber: 'INV-2024-002', partnerName: 'Vodafone Kft.', date: '2024. 01. 08.', grossAmount: 45000, vatAmount: 8910, status: 'Kontírozásra vár', type: 'bejovo' },
  { id: 'inv3', clientId: '1', invoiceNumber: 'INV-2024-003', partnerName: 'Office Depot', date: '2024. 01. 05.', grossAmount: 78500, vatAmount: 15540, status: 'Kontírozott', type: 'bejovo' },
  { id: 'inv4', clientId: '1', invoiceNumber: 'INV-2024-004', partnerName: 'Google Ireland', date: '2024. 01. 03.', grossAmount: 250000, vatAmount: 0, status: 'Exportálva', type: 'kimeno' },
  { id: 'inv5', clientId: '1', invoiceNumber: 'INV-2024-005', partnerName: 'ABC Partner Kft.', date: '2024. 01. 02.', grossAmount: 890000, vatAmount: 176220, status: 'Kontírozott', type: 'kimeno' },
  { id: 'inv6', clientId: '1', invoiceNumber: 'INV-2024-006', partnerName: 'XYZ Solutions', date: '2024. 01. 01.', grossAmount: 156000, vatAmount: 30880, status: 'Problémás', type: 'bejovo' },
];

export const globalMissingInvoicesData = [
  { id: 1, name: 'Tech Solutions Kft.', missing: 5, critical: 2, lastNotice: '2024. 01. 14. (1x)', status: 'Felszólítva', statusType: 'warning' },
  { id: 2, name: 'Digital Partners Zrt.', missing: 8, critical: 3, lastNotice: '-', status: 'Kritikus', statusType: 'danger' },
  { id: 3, name: 'Innovation Labs Kft.', missing: 8, critical: 1, lastNotice: '2024. 01. 10. (2x)', status: 'Felszólítva', statusType: 'warning' },
  { id: 4, name: 'Smart Office Bt.', missing: 2, critical: 0, lastNotice: '-', status: 'Nincs felszólítva', statusType: 'neutral' },
  { id: 5, name: 'Global Trade Kft.', missing: 6, critical: 4, lastNotice: '2024. 01. 08. (3x)', status: 'Kritikus', statusType: 'danger' },
];

const baseMissingInvoices = [
  { vendor: 'Telekom Magyarország', subtext: 'Telefon számla', amount: '45 000 Ft', source: 'NAV', priority: 'Sürgős', status: 'Bekérésre vár', statusVariant: 'neutral' },
  { vendor: 'Vodafone Kft.', subtext: 'Mobiltelefon', amount: '28 000 Ft', source: 'NAV', priority: 'Sürgős', status: 'Bekérve (1x)', statusVariant: 'warning' },
  { vendor: 'MOL Nyrt.', subtext: 'Üzemanyag', amount: '120 000 Ft', source: 'Minta', priority: 'Közepes', status: 'Bekérésre vár', statusVariant: 'neutral' },
  { vendor: 'Office Depot', subtext: 'Irodaszer rendelés', amount: '35 000 Ft', source: 'Minta', priority: 'Alacsony', status: 'Bekérve (2x)', statusVariant: 'warning' },
  { vendor: 'Ismeretlen szállító', subtext: 'Javítási munka', amount: '80 000 Ft', source: 'Kézi', priority: 'Közepes', status: 'Bekérésre vár', statusVariant: 'neutral' },
];

export const globalClientInvoices = globalMissingInvoicesData.flatMap(client => {
  return Array.from({ length: client.missing }).map((_, index) => {
    const base = baseMissingInvoices[index % baseMissingInvoices.length];
    const isCritical = index < client.critical;
    return {
      id: client.id * 1000 + index,
      clientId: client.id,
      vendor: base.vendor,
      subtext: base.subtext,
      period: '2024 Január',
      amount: base.amount,
      source: base.source,
      priority: isCritical ? 'Sürgős' : (base.priority === 'Sürgős' ? 'Közepes' : base.priority),
      status: base.status,
      statusVariant: base.statusVariant
    };
  });
});

// ── Okos Detektív: Zárást blokkoló hiányosságok ──

export type BlockingCategory = 'bejovo' | 'kimeno' | 'bank' | 'ber';

export interface BlockingItem {
  id: string;
  clientId: string;
  category: BlockingCategory;
  title: string;
  subtitle: string;
  source: string;
  amount?: string;
  date?: string;
  priority: 'urgent' | 'medium' | 'low';
  details: string;
  invoiceNumber?: string;
  resolveRoute?: string;
}

export const blockingCategoryMeta: Record<BlockingCategory, { label: string; icon: string }> = {
  bejovo:  { label: 'Bejövő',  icon: '📥' },
  kimeno:  { label: 'Kimenő',  icon: '📤' },
  bank:    { label: 'Bank',    icon: '🏦' },
  ber:     { label: 'Bér',     icon: '👥' },
};

export const mockBlockingItems: BlockingItem[] = [
  // ── Tech Solutions Kft. (id: '1') ──
  {
    id: 'bi-1-1',
    clientId: '1',
    category: 'bejovo',
    title: 'MOL Nyrt.',
    subtitle: '24.500 Ft (PDF hiányzik)',
    source: 'NAV Online Számla',
    amount: '24 500 Ft',
    date: '2024.01.15',
    priority: 'urgent',
    details: 'A NAV rendszerben rögzített bejövő számla, amelyhez nem érkezett PDF másolat a Visibillbe. Az ügyfélnek be kell küldenie a számlakép másolatát a könyveléshez.',
    invoiceNumber: 'NAV-2024-00412',
    resolveRoute: '/accounty/client/1/invoices',
  },
  {
    id: 'bi-1-2',
    clientId: '1',
    category: 'bejovo',
    title: 'Telekom Magyarország',
    subtitle: '45.000 Ft (nem párosított)',
    source: 'NAV Online Számla',
    amount: '45 000 Ft',
    date: '2024.01.10',
    priority: 'medium',
    details: 'A NAV-ból bejövő számlaként azonosított tétel, de a bankkivonaton nem található hozzá tartozó tranzakció. Lehetséges, hogy készpénzzel fizették vagy az utalás még nem történt meg.',
    invoiceNumber: 'NAV-2024-00398',
    resolveRoute: '/accounty/client/1/invoices',
  },
  {
    id: 'bi-1-3',
    clientId: '1',
    category: 'kimeno',
    title: 'Partner Kft.',
    subtitle: '120.000 Ft (számlakép hiányzik)',
    source: 'NAV Online Számla',
    amount: '120 000 Ft',
    date: '2024.01.08',
    priority: 'medium',
    details: 'Kimenő számla a NAV rendszerben megjelent, de a kiállított számla PDF-je nincs feltöltve a Visibillbe. Szükséges a számla eredeti példányának beszerzése.',
    invoiceNumber: 'NAV-2024-00385',
    resolveRoute: '/accounty/client/1/invoices',
  },
  {
    id: 'bi-1-4',
    clientId: '1',
    category: 'bank',
    title: 'Hiányzó bankkivonat',
    subtitle: 'Május 01–15 időszak',
    source: 'Bankkivonat-figyelő',
    date: '2024.05.15',
    priority: 'urgent',
    details: 'A május 1-15 közötti bankkivonat nem érkezett meg. A könyvelés lezárásához szükséges az összes banki tranzakció feldolgozása erre az időszakra.',
    resolveRoute: '/accounty/client/1/invoices',
  },
  {
    id: 'bi-1-5',
    clientId: '1',
    category: 'ber',
    title: 'Májusi jelenléti ívek',
    subtitle: 'Határidő: 2024.06.05',
    source: 'Havi kötelező nyilatkozat',
    date: '2024.06.05',
    priority: 'urgent',
    details: 'A bérszámfejtéshez szükséges jelenléti ívek nem érkeztek meg. Az ügyfélnek a portálon keresztül kell benyújtania az adatokat, vagy jelezni, hogy nem volt változás.',
  },

  // ── Webshop Hungary Zrt. (id: '2') ──
  {
    id: 'bi-2-1',
    clientId: '2',
    category: 'bejovo',
    title: 'Amazon EU S.a.r.l.',
    subtitle: '€1.250 (EU-s számla hiányzik)',
    source: 'NAV Online Számla',
    amount: '€1 250',
    date: '2024.01.12',
    priority: 'urgent',
    details: 'EU-n belüli beszerzési számla, amelynek PDF másolata szükséges az ÁFA visszaigényléshez. A NAV-ban rögzített fordított adózású tétel.',
    invoiceNumber: 'NAV-2024-00421',
    resolveRoute: '/accounty/client/2/invoices',
  },
  {
    id: 'bi-2-2',
    clientId: '2',
    category: 'bank',
    title: 'Nem párosított tranzakció',
    subtitle: '85.000 Ft utalás – 2024.01.09',
    source: 'Bankkivonat-figyelő',
    amount: '85 000 Ft',
    date: '2024.01.09',
    priority: 'medium',
    details: 'A bankkivonaton szereplő 85.000 Ft-os kimenő utaláshoz nem tartozik számla a rendszerben. Szükséges az ügyfél visszajelzése, hogy mi volt az utalás célja.',
    resolveRoute: '/accounty/client/2/invoices',
  },
  {
    id: 'bi-2-3',
    clientId: '2',
    category: 'ber',
    title: 'Táppénz igazolás',
    subtitle: '1 fő – 2024 január',
    source: 'Havi kötelező nyilatkozat',
    date: '2024.01.31',
    priority: 'medium',
    details: 'Az ügyfél jelezte, hogy az egyik munkavállalója táppénzen volt januárban, de a TB igazolás még nem érkezett meg a bérszámfejtéshez.',
  },

  // ── Gastro Delight Kft. (id: '4') ──
  {
    id: 'bi-4-1',
    clientId: '4',
    category: 'bejovo',
    title: 'Metro Cash & Carry',
    subtitle: '156.000 Ft (3 számla hiányzik)',
    source: 'NAV Online Számla',
    amount: '156 000 Ft',
    date: '2024.01.14',
    priority: 'urgent',
    details: 'A NAV-ban 3 különálló Metro számla szerepel az elmúlt hónapból, amelyekhez nem érkeztek PDF másolatok. Vendéglátós cég lévén ezek kritikus tételek az ÁFA-hoz.',
    invoiceNumber: 'NAV-2024-00445, -00446, -00447',
    resolveRoute: '/accounty/client/4/invoices',
  },
  {
    id: 'bi-4-2',
    clientId: '4',
    category: 'kimeno',
    title: 'Esküvői rendezvény',
    subtitle: '450.000 Ft (kimenő számla hiányzik)',
    source: 'Bankkivonat-figyelő',
    amount: '450 000 Ft',
    date: '2024.01.11',
    priority: 'urgent',
    details: 'A bankszámlán beérkezett 450.000 Ft összeghez nem tartozik kimenő számla a rendszerben. Feltehetően az ügyfél elfelejtett számlát kiállítani a rendezvényről.',
    resolveRoute: '/accounty/client/4/invoices',
  },

  // ── Green Energy Solutions (id: '5') ──
  {
    id: 'bi-5-1',
    clientId: '5',
    category: 'bejovo',
    title: 'E.ON Energiaszolgáltató',
    subtitle: '89.000 Ft (áram + gáz)',
    source: 'NAV Online Számla',
    amount: '89 000 Ft',
    date: '2024.01.05',
    priority: 'medium',
    details: 'Az E.ON-tól érkezett közüzemi számla a NAV-ban rögzítve, de a PDF nincs feltöltve. Szükséges az áram és gáz számlák különválasztott könyvelése.',
    invoiceNumber: 'NAV-2024-00302',
    resolveRoute: '/accounty/client/5/invoices',
  },
  {
    id: 'bi-5-2',
    clientId: '5',
    category: 'bank',
    title: 'Ismeretlen utalások',
    subtitle: '3 db, összesen 215.000 Ft',
    source: 'Bankkivonat-figyelő',
    amount: '215 000 Ft',
    date: '2024.01.08',
    priority: 'urgent',
    details: 'A bankkivonaton 3 ismeretlen utalás szerepel, amelyekhez nem párosítható számla. Az ügyfél nyilatkozata szükséges az egyes tételekről.',
    resolveRoute: '/accounty/client/5/invoices',
  },
  {
    id: 'bi-5-3',
    clientId: '5',
    category: 'ber',
    title: 'Jelenléti ívek + szabadság',
    subtitle: 'Januári bérszámfejtés',
    source: 'Havi kötelező nyilatkozat',
    date: '2024.02.05',
    priority: 'urgent',
    details: 'A januári bérszámfejtéshez szükséges jelenléti ívek és szabadság nyilvántartás nem érkezett meg. 2 alkalmazottra vonatkozóan szükségesek az adatok.',
  },
];

