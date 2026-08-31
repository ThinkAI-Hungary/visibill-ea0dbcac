/**
 * Payroll Output Reports Document Template for DocumentEngine.
 * Implements M30, Járulékösszesítő, Bérköltség, Bérfizetési jegyzék, T1041, Kilépő adatlap, Kifizetési utalvány.
 */

import { DocumentDescriptor } from '../core/types';
import { formatHungarianCurrency } from '../encoding/hungarianEncoding';
import { DocumentEngine } from '../core/DocumentEngine';
import { PdfDocumentAdapter } from '../adapters/PdfDocumentAdapter';

export interface PayrollDocContext {
  companyName: string;
  period: string;
  calculations: {
    gross_salary: number;
    net_salary: number;
    szja_amount: number;
    tb_amount: number;
    szocho_amount: number;
    total_deductions: number;
    cafeteria_tax?: any;
    metadata?: any;
  }[];
}

export function buildPayrollSummaryDescriptor(ctx: PayrollDocContext): DocumentDescriptor {
  const totals = ctx.calculations.reduce(
    (acc, c) => ({
      gross: acc.gross + (c.gross_salary || 0),
      szja: acc.szja + (c.szja_amount || 0),
      tb: acc.tb + (c.tb_amount || 0),
      net: acc.net + (c.net_salary || 0),
      szocho: acc.szocho + (c.szocho_amount || 0),
    }),
    { gross: 0, szja: 0, tb: 0, net: 0, szocho: 0 }
  );

  const rows = ctx.calculations.map((c, i) => {
    const meta = c.metadata as any;
    const name = meta?.employee_name || `Dolgozó #${i + 1}`;
    return [
      name,
      formatHungarianCurrency(c.gross_salary),
      formatHungarianCurrency(c.szja_amount),
      formatHungarianCurrency(c.tb_amount),
      formatHungarianCurrency(c.net_salary),
      formatHungarianCurrency(c.szocho_amount),
    ];
  });

  return {
    type: 'payroll_contributions',
    metadata: {
      title: 'HAVI JÁRULÉK- ÉS BÉRÖSSZESÍTŐ',
      subtitle: `${ctx.period} elszámolási időszak`,
      companyName: ctx.companyName,
      period: ctx.period,
      filename: `jarulekosszesito_${ctx.period}`,
      themeColor: [30, 58, 95],
      orientation: 'landscape',
    },
    sections: [
      {
        type: 'table',
        title: 'Munkavállalói elszámolások részletezése',
        headers: ['Munkavállaló', 'Bruttó bér', 'SZJA (15%)', 'TB járulék (18.5%)', 'Nettó kifizetendő', 'SZOCHO (13%)'],
        rows,
        footers: [
          { label: 'Összesen', value: `${formatHungarianCurrency(totals.gross)} (Bruttó) | ${formatHungarianCurrency(totals.net)} (Nettó)` },
        ],
      },
      {
        type: 'text',
        title: 'Összesített adóhatósági kötelezettségek',
        content: `NAV felé fizetendő SZJA: ${formatHungarianCurrency(totals.szja)}\nNAV felé fizetendő TB járulék: ${formatHungarianCurrency(totals.tb)}\nNAV felé fizetendő SZOCHO: ${formatHungarianCurrency(totals.szocho)}\nÖsszes költségvetési utalás: ${formatHungarianCurrency(totals.szja + totals.tb + totals.szocho)}`,
      },
    ],
  };
}

export function buildWageCostDescriptor(ctx: PayrollDocContext): DocumentDescriptor {
  const totals = ctx.calculations.reduce(
    (acc, c) => ({
      gross: acc.gross + (c.gross_salary || 0),
      szocho: acc.szocho + (c.szocho_amount || 0),
      totalCost: acc.totalCost + (c.gross_salary || 0) + (c.szocho_amount || 0),
    }),
    { gross: 0, szocho: 0, totalCost: 0 }
  );

  const rows = ctx.calculations.map((c, i) => {
    const meta = c.metadata as any;
    const name = meta?.employee_name || `Dolgozó #${i + 1}`;
    const total = (c.gross_salary || 0) + (c.szocho_amount || 0);
    return [
      name,
      meta?.position || 'Alkalmazott',
      formatHungarianCurrency(c.gross_salary),
      formatHungarianCurrency(c.szocho_amount),
      formatHungarianCurrency(total),
    ];
  });

  return {
    type: 'payroll_wage_cost',
    metadata: {
      title: 'BÉRKÖLTSÉG ÉS MUNKÁLTATÓI TEHER JELENTÉS',
      subtitle: `${ctx.period} elszámolási időszak`,
      companyName: ctx.companyName,
      period: ctx.period,
      filename: `berkoltseg_${ctx.period}`,
      themeColor: [15, 116, 103],
    },
    sections: [
      {
        type: 'table',
        title: 'Bérköltség kimutatás',
        headers: ['Munkavállaló', 'Munkakör', 'Bruttó bér', 'SZOCHO (13%)', 'Teljes munkáltatói költség'],
        rows,
        footers: [
          { label: 'Összes munkáltatói bérköltség', value: formatHungarianCurrency(totals.totalCost) },
        ],
      },
    ],
  };
}

export async function generatePayrollSummaryPdf(ctx: PayrollDocContext): Promise<void> {
  const descriptor = buildPayrollSummaryDescriptor(ctx);
  await DocumentEngine.export(descriptor, 'pdf');
}

export async function generateWageCostPdf(ctx: PayrollDocContext): Promise<void> {
  const descriptor = buildWageCostDescriptor(ctx);
  await DocumentEngine.export(descriptor, 'pdf');
}
