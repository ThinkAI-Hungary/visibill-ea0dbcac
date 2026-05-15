export interface ClientData {
  id: string;
  name: string;
  taxNumber: string;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  unprocessedCount: number;
  missingCount: number;
  deadline: string;
  colorHex: string; // for the initial logo background
}

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
    colorHex: 'bg-emerald-100 text-emerald-600',
  },
  {
    id: '2',
    name: 'Webshop Hungary Zrt.',
    taxNumber: '87654321-2-41',
    status: 'Kritikus',
    unprocessedCount: 12,
    missingCount: 0,
    deadline: 'jan. 15.',
    colorHex: 'bg-amber-100 text-amber-600',
  },
  {
    id: '3',
    name: 'Építő Mesterei Bt.',
    taxNumber: '11223344-1-13',
    status: 'Rendben',
    unprocessedCount: 0,
    missingCount: 0,
    deadline: 'jan. 25.',
    colorHex: 'bg-indigo-100 text-indigo-600',
  },
  {
    id: '4',
    name: 'Gastro Delight Kft.',
    taxNumber: '55667788-1-42',
    status: 'Feldolgozandó',
    unprocessedCount: 3,
    missingCount: 1,
    deadline: 'jan. 18.',
    colorHex: 'bg-pink-100 text-pink-600',
  },
  {
    id: '5',
    name: 'Green Energy Solutions',
    taxNumber: '99887766-2-43',
    status: 'Kritikus',
    unprocessedCount: 8,
    missingCount: 4,
    deadline: 'jan. 12.',
    colorHex: 'bg-teal-100 text-teal-600',
  },
];
