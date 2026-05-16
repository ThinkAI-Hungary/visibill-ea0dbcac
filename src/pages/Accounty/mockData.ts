export interface ClientData {
  id: string;
  name: string;
  taxNumber: string;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  unprocessedCount: number;
  missingCount: number;
  deadline: string;
  colorHex: string; // for the initial logo background
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

