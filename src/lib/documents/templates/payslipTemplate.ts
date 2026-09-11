/**
 * Payslip document template and descriptor builder.
 * Mt. 155. § (2) compliant Hungarian payslip.
 */

import { DocumentDescriptor } from '../core/types';
import { formatHungarianCurrency } from '../encoding/hungarianEncoding';
import { DocumentEngine } from '../core/DocumentEngine';
import { PdfDocumentAdapter } from '../adapters/PdfDocumentAdapter';

export interface PayslipData {
  employeeName: string;
  period: string;
  grossSalary: number;
  szjaAmount: number;
  tbAmount: number;
  szochoAmount: number;
  netSalary: number;
  totalDeductions: number;
  taxCredits?: Record<string, any>;
  deductions?: Record<string, any>;
  cafeteriaTax?: Record<string, any>;
  companyName?: string;
}

export function buildPayslipDescriptor(data: PayslipData): DocumentDescriptor {
  const descriptor: DocumentDescriptor = {
    type: 'payslip',
    metadata: {
      title: 'BÉRJEGYZÉK',
      subtitle: 'Mt. 155. § (2) szerinti havi elszámolás',
      companyName: data.companyName,
      period: data.period,
      filename: `berjegyzek_${data.employeeName.replace(/\s+/g, '_')}_${data.period}`,
      themeColor: [30, 58, 95], // Dark navy
    },
    sections: [
      {
        type: 'key-value',
        title: 'Munkavállaló adatai',
        items: [
          { label: 'Név', value: data.employeeName, highlight: true },
          { label: 'Elszámolási időszak', value: data.period },
        ],
      },
      {
        type: 'table',
        title: 'Bérelemek és levonások',
        headers: ['Megnevezés', 'Típus', 'Összeg'],
        rows: [
          ['Bruttó bér / Alapbér', 'Járandóság', formatHungarianCurrency(data.grossSalary)],
          ['SZJA előleg (15%)', 'Levonás', formatHungarianCurrency(data.szjaAmount)],
          ['Társadalombiztosítási járulék (18.5%)', 'Levonás', formatHungarianCurrency(data.tbAmount)],
          ['Levonások összesen', 'Összesítő', formatHungarianCurrency(data.totalDeductions)],
          ['Nettó kifizetendő bér', 'Kifizetés', formatHungarianCurrency(data.netSalary)],
          ['Munkáltatói SZOCHO (13%)', 'Munkáltatói teher', formatHungarianCurrency(data.szochoAmount)],
        ],
      },
      {
        type: 'text',
        title: 'Jogszabályi záradék',
        style: 'legal',
        content: 'A jelen bérjegyzék a Munka Törvénykönyvéről szóló 2012. évi I. törvény (Mt.) 155. § (2) bekezdésének megfelelően készült. Az adatok a cég bérszámfejtési nyilvántartásával megegyeznek.',
      },
    ],
  };

  return descriptor;
}

export async function generatePayslipPdf(data: PayslipData): Promise<void> {
  const descriptor = buildPayslipDescriptor(data);
  await DocumentEngine.export(descriptor, 'pdf');
}

export async function downloadPayslipPdf(arg1: string | PayslipData, arg2?: PayslipData): Promise<void> {
  const data = (typeof arg1 === 'string' ? arg2 : arg1) as PayslipData;
  const customFilename = typeof arg1 === 'string' ? arg1 : undefined;
  const descriptor = buildPayslipDescriptor(data);
  await DocumentEngine.export(descriptor, 'pdf', customFilename);
}

export async function generatePayslipBlob(data: PayslipData): Promise<Blob> {
  const descriptor = buildPayslipDescriptor(data);
  return PdfDocumentAdapter.renderToBlob(descriptor);
}

export async function getPayslipPdfPreviewUrl(data: PayslipData): Promise<string> {
  const blob = await generatePayslipBlob(data);
  return URL.createObjectURL(blob);
}

export function getPayslipPreviewUrl(data: PayslipData): string {
  const descriptor = buildPayslipDescriptor(data);
  return DocumentEngine.createPreviewUrl(descriptor);
}

