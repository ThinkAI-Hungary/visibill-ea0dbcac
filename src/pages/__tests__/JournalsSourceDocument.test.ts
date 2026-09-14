import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Journals and Transactions Source Document Preview and Download', () => {
  const journalsPath = path.resolve(__dirname, '../JournalsPage.tsx');
  const journalsContent = fs.readFileSync(journalsPath, 'utf8');

  const txCardPath = path.resolve(__dirname, '../../components/transaction-details/TransactionCard.tsx');
  const txCardContent = fs.readFileSync(txCardPath, 'utf8');

  it('JournalsPage imports required document utilities and components', () => {
    expect(journalsContent).toContain("import { extractStoragePath } from '@/lib/utils';");
    expect(journalsContent).toContain("import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';");
    expect(journalsContent).toContain('Download');
    expect(journalsContent).toContain('ExternalLink');
  });

  it('JournalsPage has query for source document resolving AUTO_BANK and AUTO_SZAMLA', () => {
    expect(journalsContent).toContain("queryKey: ['acc-journal-source-doc'");
    expect(journalsContent).toContain("selectedEntry.source === 'AUTO_BANK'");
    expect(journalsContent).toContain("selectedEntry.source === 'AUTO_SZAMLA'");
    expect(journalsContent).toContain("from('transactions')");
    expect(journalsContent).toContain("upload:transaction_uploads(id, file_name, file_url)");
    expect(journalsContent).toContain("from('invoices')");
    expect(journalsContent).toContain("from('nav_invoices')");
  });

  it('JournalsPage renders source document card in Drawer with view and download buttons', () => {
    expect(journalsContent).toContain('Csatolt eredeti bankkivonat');
    expect(journalsContent).toContain('Csatolt bizonylat / számla');
    expect(journalsContent).toContain('Megnyitás');
    expect(journalsContent).toContain('Letöltés');
    expect(journalsContent).toContain('handleDownloadSourceDoc');
    expect(journalsContent).toContain('<InvoiceDetailPopup');
  });

  it('TransactionCard renders attached bank statement upload with download and open buttons', () => {
    expect(txCardContent).toContain("queryKey: ['transaction-upload-file'");
    expect(txCardContent).toContain("upload:transaction_uploads(id, file_name, file_url)");
    expect(txCardContent).toContain('Csatolt eredeti bankkivonat');
    expect(txCardContent).toContain('Megnyitás');
    expect(txCardContent).toContain('Letöltés');
    expect(txCardContent).toContain('handleDownloadUpload');
    expect(txCardContent).toContain('extractStoragePath');
  });
});
