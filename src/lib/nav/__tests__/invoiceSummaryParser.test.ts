import { describe, it, expect } from 'vitest';
import { parseInvoiceSummary, parseInvoiceDataXml } from '../../../../supabase/functions/_shared/nav/xml-parser.ts';

describe('NAV Online Számla v3.0 – Hivatalos ÁFA Összesítő (<invoiceSummary>) Parser', () => {
  it('correctly parses multi-vatRate summaryNormal with currency and HUF amounts', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:base="http://schemas.nav.gov.hu/OSA/3.0/base">
  <invoiceData>
    <invoiceMain>
      <invoice>
        <invoiceSummary>
          <summaryNormal>
            <summaryByVatRate>
              <vatRate>
                <vatPercentage>0.27</vatPercentage>
              </vatRate>
              <vatRateNetData>
                <vatRateNetAmount>1000.00</vatRateNetAmount>
                <vatRateNetAmountHUF>390000.00</vatRateNetAmountHUF>
              </vatRateNetData>
              <vatRateVatData>
                <vatRateVatAmount>270.00</vatRateVatAmount>
                <vatRateVatAmountHUF>105300.00</vatRateVatAmountHUF>
              </vatRateVatData>
              <vatRateGrossData>
                <vatRateGrossAmount>1270.00</vatRateGrossAmount>
                <vatRateGrossAmountHUF>495300.00</vatRateGrossAmountHUF>
              </vatRateGrossData>
            </summaryByVatRate>
            <summaryByVatRate>
              <vatRate>
                <vatPercentage>0.05</vatPercentage>
              </vatRate>
              <vatRateNetData>
                <vatRateNetAmount>200.00</vatRateNetAmount>
                <vatRateNetAmountHUF>78000.00</vatRateNetAmountHUF>
              </vatRateNetData>
              <vatRateVatData>
                <vatRateVatAmount>10.00</vatRateVatAmount>
                <vatRateVatAmountHUF>3900.00</vatRateVatAmountHUF>
              </vatRateVatData>
              <vatRateGrossData>
                <vatRateGrossAmount>210.00</vatRateGrossAmount>
                <vatRateGrossAmountHUF>81900.00</vatRateGrossAmountHUF>
              </vatRateGrossData>
            </summaryByVatRate>
            <invoiceNetAmount>1200.00</invoiceNetAmount>
            <invoiceNetAmountHUF>468000.00</invoiceNetAmountHUF>
            <invoiceVatAmount>280.00</invoiceVatAmount>
            <invoiceVatAmountHUF>109200.00</invoiceVatAmountHUF>
          </summaryNormal>
          <summaryGrossData>
            <invoiceGrossAmount>1480.00</invoiceGrossAmount>
            <invoiceGrossAmountHUF>577200.00</invoiceGrossAmountHUF>
          </summaryGrossData>
        </invoiceSummary>
      </invoice>
    </invoiceMain>
  </invoiceData>
</QueryInvoiceDataResponse>`;

    const summary = parseInvoiceSummary(xml);
    expect(summary).toBeDefined();
    expect(summary?.vatSummaries.length).toBe(2);

    const s27 = summary?.vatSummaries[0];
    expect(s27?.category).toBe('percentage');
    expect(s27?.vatRateLiteral).toBe('27%');
    expect(s27?.vatPercentage).toBe(0.27);
    expect(s27?.netAmount).toBe(1000);
    expect(s27?.netAmountHUF).toBe(390000);
    expect(s27?.vatAmount).toBe(270);
    expect(s27?.vatAmountHUF).toBe(105300);
    expect(s27?.grossAmount).toBe(1270);
    expect(s27?.grossAmountHUF).toBe(495300);

    const s05 = summary?.vatSummaries[1];
    expect(s05?.category).toBe('percentage');
    expect(s05?.vatRateLiteral).toBe('5%');
    expect(s05?.vatPercentage).toBe(0.05);
    expect(s05?.netAmount).toBe(200);

    expect(summary?.invoiceNetAmount).toBe(1200);
    expect(summary?.invoiceNetAmountHUF).toBe(468000);
    expect(summary?.invoiceVatAmount).toBe(280);
    expect(summary?.invoiceVatAmountHUF).toBe(109200);
    expect(summary?.invoiceGrossAmount).toBe(1480);
    expect(summary?.invoiceGrossAmountHUF).toBe(577200);
    expect(summary?.hasReverseCharge).toBe(false);
  });

  it('correctly parses vatExemption with case and reason (AAM / TAM)', () => {
    const xml = `<invoiceSummary>
      <summaryNormal>
        <summaryByVatRate>
          <vatRate>
            <vatExemption>
              <case>AAM</case>
              <reason>Alanyi adómentes (Áfa tv. XIII. fejezet)</reason>
            </vatExemption>
          </vatRate>
          <vatRateNetData>
            <vatRateNetAmount>50000.00</vatRateNetAmount>
            <vatRateNetAmountHUF>50000.00</vatRateNetAmountHUF>
          </vatRateNetData>
          <vatRateVatData>
            <vatRateVatAmount>0.00</vatRateVatAmount>
            <vatRateVatAmountHUF>0.00</vatRateVatAmountHUF>
          </vatRateVatData>
          <vatRateGrossData>
            <vatRateGrossAmount>50000.00</vatRateGrossAmount>
            <vatRateGrossAmountHUF>50000.00</vatRateGrossAmountHUF>
          </vatRateGrossData>
        </summaryByVatRate>
      </summaryNormal>
    </invoiceSummary>`;

    const summary = parseInvoiceSummary(xml);
    expect(summary).toBeDefined();
    expect(summary?.vatSummaries.length).toBe(1);
    const item = summary!.vatSummaries[0];
    expect(item.category).toBe('exemption');
    expect(item.exemptionCase).toBe('AAM');
    expect(item.exemptionReason).toBe('Alanyi adómentes (Áfa tv. XIII. fejezet)');
    expect(item.vatRateLiteral).toBe('AAM');
    expect(item.vatAmount).toBe(0);
    expect(item.grossAmount).toBe(50000);
  });

  it('correctly parses domestic reverse charge and flags hasReverseCharge', () => {
    const xml = `<invoiceSummary>
      <summaryNormal>
        <summaryByVatRate>
          <vatRate>
            <vatDomesticReverseCharge>true</vatDomesticReverseCharge>
          </vatRate>
          <vatRateNetData>
            <vatRateNetAmount>250000.00</vatRateNetAmount>
          </vatRateNetData>
          <vatRateVatData>
            <vatRateVatAmount>0.00</vatRateVatAmount>
          </vatRateVatData>
        </summaryByVatRate>
      </summaryNormal>
    </invoiceSummary>`;

    const summary = parseInvoiceSummary(xml);
    expect(summary).toBeDefined();
    expect(summary?.hasReverseCharge).toBe(true);
    expect(summary?.vatSummaries[0].category).toBe('reverse_charge');
    expect(summary?.vatSummaries[0].isReverseCharge).toBe(true);
    expect(summary?.vatSummaries[0].vatRateLiteral).toContain('Fordított adózás');
  });

  it('correctly parses marginSchemeIndicator (különbözet szerinti adózás)', () => {
    const xml = `<invoiceSummary>
      <summaryNormal>
        <summaryByVatRate>
          <vatRate>
            <marginSchemeIndicator>TRAVEL_AGENCY</marginSchemeIndicator>
          </vatRate>
          <vatRateNetData>
            <vatRateNetAmount>150000.00</vatRateNetAmount>
          </vatRateNetData>
          <vatRateVatData>
            <vatRateVatAmount>0.00</vatRateVatAmount>
          </vatRateVatData>
        </summaryByVatRate>
      </summaryNormal>
    </invoiceSummary>`;

    const summary = parseInvoiceSummary(xml);
    expect(summary).toBeDefined();
    expect(summary?.vatSummaries[0].category).toBe('margin_scheme');
    expect(summary?.vatSummaries[0].marginSchemeIndicator).toBe('TRAVEL_AGENCY');
    expect(summary?.vatSummaries[0].vatRateLiteral).toContain('TRAVEL_AGENCY');
  });

  it('correctly parses simplified invoice summary (vatContent)', () => {
    const xml = `<invoiceSummary>
      <summarySimplified>
        <summaryByVatRate>
          <vatRate>
            <vatContent>0.2126</vatContent>
          </vatRate>
          <vatRateGrossData>
            <vatRateGrossAmount>10000.00</vatRateGrossAmount>
          </vatRateGrossData>
        </summaryByVatRate>
      </summarySimplified>
    </invoiceSummary>`;

    const summary = parseInvoiceSummary(xml);
    expect(summary).toBeDefined();
    expect(summary?.vatSummaries[0].category).toBe('content');
    expect(summary?.vatSummaries[0].vatContent).toBe(0.2126);
    expect(summary?.vatSummaries[0].vatRateLiteral).toContain('27%');
  });

  it('populates missing line item vat from single-vatRate summary (MVM utility case, D-3)', () => {
    const invoiceXml = `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <invoiceData>
    <invoiceMain>
      <invoice>
        <invoiceHead>
          <supplierInfo>
            <supplierName>MVM Next Energiakereskedelmi Zrt.</supplierName>
          </supplierInfo>
        </invoiceHead>
        <invoiceLines>
          <line>
            <lineNumber>1</lineNumber>
            <lineDescription>Villamos energia díj</lineDescription>
            <lineNetAmount>10000.00</lineNetAmount>
          </line>
          <line>
            <lineNumber>2</lineNumber>
            <lineDescription>Rendszerhasználati díj</lineDescription>
            <lineNetAmount>5000.00</lineNetAmount>
          </line>
        </invoiceLines>
        <invoiceSummary>
          <summaryNormal>
            <summaryByVatRate>
              <vatRate>
                <vatPercentage>0.27</vatPercentage>
              </vatRate>
              <vatRateNetData>
                <vatRateNetAmount>15000.00</vatRateNetAmount>
              </vatRateNetData>
              <vatRateVatData>
                <vatRateVatAmount>4050.00</vatRateVatAmount>
              </vatRateVatData>
              <vatRateGrossData>
                <vatRateGrossAmount>19050.00</vatRateGrossAmount>
              </vatRateGrossData>
            </summaryByVatRate>
            <invoiceNetAmount>15000.00</invoiceNetAmount>
            <invoiceVatAmount>4050.00</invoiceVatAmount>
          </summaryNormal>
          <summaryGrossData>
            <invoiceGrossAmount>19050.00</invoiceGrossAmount>
          </summaryGrossData>
        </invoiceSummary>
      </invoice>
    </invoiceMain>
  </invoiceData>
</QueryInvoiceDataResponse>`;

    const details = parseInvoiceDataXml(invoiceXml);
    expect(details.vatSummary).toBeDefined();
    expect(details.vatSummary?.vatSummaries.length).toBe(1);
    expect(details.lineItems).toBeDefined();
    expect(details.lineItems?.length).toBe(2);

    // Line 1 should have had VAT calculated: 10000 * 0.27 = 2700, gross = 12700
    const l1 = details.lineItems![0];
    expect(l1.vatAmount).toBe(2700);
    expect(l1.grossAmount).toBe(12700);
    expect(l1.vatRate).toBe('0.27');

    // Line 2 should have had VAT calculated: 5000 * 0.27 = 1350, gross = 6350
    const l2 = details.lineItems![1];
    expect(l2.vatAmount).toBe(1350);
    expect(l2.grossAmount).toBe(6350);
  });
});
