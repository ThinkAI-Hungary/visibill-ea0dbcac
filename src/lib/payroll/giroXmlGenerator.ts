/**
 * GIRO / HCT (Hungarian Credit Transfer) & SEPA pain.001.001.03 XML Generator
 * Standardized ISO 20022 Customer Credit Transfer Initiation file
 * for uploading batch employee payroll payouts to Hungarian bank portals
 * (OTP, Erste, MBH, Raiffeisen, K&H, CIB, UniCredit, etc.)
 */

export interface GiroEmployeePayoutItem {
  employeeId: string;
  employeeName: string;
  bankAccount: string; // Hungarian format (16 or 24 digits) or IBAN
  netSalary: number; // in HUF
  currency?: string; // Default 'HUF'
  remittanceInfo?: string; // e.g. "Munkabér 2026/01"
}

export interface GiroBatchParams {
  companyName: string;
  companyTaxNumber?: string;
  debtorIban: string;
  debtorBic?: string;
  executionDate: string; // YYYY-MM-DD
  batchReference: string; // e.g. "BER-2026-01"
  payoutItems: GiroEmployeePayoutItem[];
}

/**
 * Normalizes Hungarian bank account to IBAN format (e.g. HU42 1177 3016 1234 5678 0000 0000)
 */
export function formatToIban(accountOrIban: string): string {
  if (!accountOrIban) return '';
  const clean = accountOrIban.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.startsWith('HU')) {
    return clean;
  }

  // 16 or 24 digit Hungarian GIRO account number
  let fullBban = clean;
  if (clean.length === 16) {
    fullBban = clean + '00000000';
  }

  if (fullBban.length === 24) {
    // Calculate MOD-97 check digits for ISO 7064
    // Rearrange: BBAN + "HU00" (H=17, U=30) -> BBAN + 173000
    const rearranged = fullBban + '173000';
    let remainder = 0;
    for (let i = 0; i < rearranged.length; i++) {
      remainder = (remainder * 10 + parseInt(rearranged[i], 10)) % 97;
    }
    const checkDigits = (98 - remainder).toString().padStart(2, '0');
    return `HU${checkDigits}${fullBban}`;
  }

  return clean;
}

/**
 * Generates ISO 20022 pain.001.001.03 XML string
 */
export function generateGiroPayrollXml(params: GiroBatchParams): string {
  const {
    companyName,
    companyTaxNumber,
    debtorIban,
    debtorBic = 'GIROHUHB',
    executionDate,
    batchReference,
    payoutItems,
  } = params;

  const validItems = payoutItems.filter((i) => i.netSalary > 0 && i.bankAccount);
  const totalAmount = validItems.reduce((sum, item) => sum + Math.round(item.netSalary), 0);
  const numberOfTransactions = validItems.length;
  const now = new Date();
  const creationDateTime = now.toISOString().replace(/\.\d{3}Z$/, '');
  const messageId = `VISIBILL-${batchReference.replace(/[^A-Za-z0-9]/g, '')}-${now.getTime()}`;

  const cleanDebtorIban = formatToIban(debtorIban);

  const escapeXml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const transactionsXml = validItems
    .map((item, index) => {
      const endToEndId = `${messageId}-${index + 1}`;
      const credIban = formatToIban(item.bankAccount);
      const remittance = item.remittanceInfo || `Munkabér ${batchReference}`;
      const currency = item.currency || 'HUF';

      return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${currency}">${Math.round(item.netSalary)}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${escapeXml(item.employeeName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${escapeXml(credIban)}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${escapeXml(remittance)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(messageId)}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(companyName)}</Nm>
        ${
          companyTaxNumber
            ? `<Id><OrgId><Othr><Id>${escapeXml(companyTaxNumber)}</Id></Othr></OrgId></Id>`
            : ''
        }
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(batchReference)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${executionDate}</ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(companyName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${escapeXml(cleanDebtorIban)}</IBAN>
        </Id>
        <Ccy>HUF</Ccy>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(debtorBic)}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
${transactionsXml}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

/**
 * Triggers a browser download of the generated GIRO XML string
 */
export function downloadGiroXmlFile(xmlContent: string, filename: string): void {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xml') ? filename : `${filename}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
