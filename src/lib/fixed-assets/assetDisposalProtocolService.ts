import { supabase } from '@/integrations/supabase/client';
import type { FixedAsset } from '@/types/fixed-assets';
import {
  buildDisposalProtocolFileName,
  generateAssetDisposalProtocolPdf,
  type DisposalProtocolData,
  type DisposalProtocolJournalLine,
} from './assetDisposalProtocolPdf';

export interface DisposalProtocolContext {
  accumulatedDepreciation?: number;
  netBookValue?: number;
  journalDocumentId?: string;
  journalLines?: DisposalProtocolJournalLine[];
}

/** A kivezetési jegyzőkönyv adatai az eszköz `disposal_*` mezőiből (+ opcionális könyvelési előnézet). */
export function buildDisposalProtocolData(
  asset: FixedAsset,
  company: { name?: string | null; address?: string | null; tax_number?: string | null } | null,
  context: DisposalProtocolContext = {},
): DisposalProtocolData {
  const details = asset.disposal_details ?? null;
  const requestedDate = details?.requested_disposal_date;
  const reason = details?.reason;

  return {
    reasonType: asset.disposal_reason_type ?? 'scrapping',
    disposalStatus: asset.disposal_status,
    companyName: company?.name || 'Cég neve',
    companyAddress: company?.address || asset.location?.address || '',
    companyTaxNumber: company?.tax_number || '',
    protocolNumber: `KIV-${asset.inventory_number}`,
    disposalDate: asset.disposal_date || requestedDate || new Date().toISOString().split('T')[0],
    assetName: asset.name,
    inventoryNumber: asset.inventory_number,
    vtszTeszor: asset.vtsz_teszor || undefined,
    activationDate: asset.activation_date || undefined,
    locationNameAddress: asset.location?.name
      ? `${asset.location.name}${asset.location.address ? ` (${asset.location.address})` : ''}`
      : undefined,
    acquisitionValue: asset.acquisition_value,
    accumulatedDepreciation: context.accumulatedDepreciation,
    netBookValue: context.netBookValue,
    reason,
    committee: asset.disposal_committee,
    waste: asset.disposal_waste_info,
    details,
    liableEmployeeName: details?.liable_employee_name,
    journalDocumentId: context.journalDocumentId,
    journalLines: context.journalLines,
  };
}

/** Legenerálja és letölti a kivezetési jegyzőkönyv PDF-et. */
export async function downloadDisposalProtocol(
  asset: FixedAsset,
  companyId: string,
  context: DisposalProtocolContext = {},
): Promise<string> {
  const { data: company } = await supabase
    .from('companies')
    .select('name, tax_number, address')
    .eq('id', companyId)
    .maybeSingle();

  const data = buildDisposalProtocolData(asset, company, context);
  const doc = generateAssetDisposalProtocolPdf(data);
  const fileName = buildDisposalProtocolFileName(data.reasonType, asset.inventory_number);
  doc.save(fileName);
  return fileName;
}
