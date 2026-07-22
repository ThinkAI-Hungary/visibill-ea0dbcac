import { supabase } from '@/integrations/supabase/client';

/**
 * EV Cashbook XML Export Utility for ÁNYK and ONYA formats.
 */

export interface EvCashbookExportData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  taxYear: number;
  periodFrom: string;
  periodTo: string;
  entries: Array<{
    id: string;
    serialNumber: number;
    entryDate: string;
    documentNumber: string;
    description: string;
    direction: 'bevetel' | 'kiadas';
    category: string;
    categoryLabel: string;
    amount: number;
    vatAmount: number;
    periodClosed: boolean;
    isStorno: boolean;
  }>;
}

/**
 * Generates and downloads ÁNYK XML for the EV cashbook
 */
export async function exportEvCashbookAnykXml(data: EvCashbookExportData) {
  try {
    const { data: responseData, error } = await supabase.functions.invoke('accounty-generate-xml', {
      body: {
        type: 'cashbook-anyk',
        data
      }
    });

    if (error || !responseData?.xml) {
      throw error || new Error('Az XML generálás sikertelen volt');
    }

    const xml = responseData.xml;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ANYK_PENZTARKONYV_${data.taxYear}_${(data.companyName || 'EV').replace(/\s+/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('ANYK export error:', err);
    throw err;
  }
}

/**
 * Generates and downloads ONYA XML for the EV cashbook
 */
export async function exportEvCashbookOnyaXml(data: EvCashbookExportData) {
  try {
    const { data: responseData, error } = await supabase.functions.invoke('accounty-generate-xml', {
      body: {
        type: 'cashbook-onya',
        data
      }
    });

    if (error || !responseData?.xml) {
      throw error || new Error('Az ONYA XML generálás sikertelen volt');
    }

    const xml = responseData.xml;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ONYA_PENZTARKONYV_${data.taxYear}_${(data.companyName || 'EV').replace(/\s+/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('ONYA export error:', err);
    throw err;
  }
}

