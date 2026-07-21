import fs from 'fs';

function extractTag(xml: string, tagName: string): string {
  const regex = new RegExp(`<(?:\\w+:)?${tagName}>([^<]*)<\\/(?:\\w+:)?${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

function buildAddressString(xml: string, parentTag: string): string {
  const parentRegex = new RegExp(`<(${parentTag})>([\\s\\S]*?)<\\/\\1>`, 'i');
  const parentMatch = xml.match(parentRegex);
  if (!parentMatch) return '';
  const parentContent = parentMatch[2];
  const country = extractTag(parentContent, 'countryCode');
  const postal = extractTag(parentContent, 'postalCode');
  const city = extractTag(parentContent, 'city');
  const street = extractTag(parentContent, 'streetName');
  const cat = extractTag(parentContent, 'publicPlaceCategory');
  const num = extractTag(parentContent, 'number');
  const add = extractTag(parentContent, 'additionalAddressDetail');
  
  const parts = [country, postal, city, street, cat, num, add].map(p => p.trim()).filter(Boolean);
  return parts.join(', ');
}

function parseInvoiceLines(xml: string): any[] {
  const lineItems: any[] = [];
  const lineRegex = /<line>[\s\S]*?<\/line>/gi;
  const lineMatches = xml.match(lineRegex);
  if (!lineMatches) return lineItems;
  lineMatches.forEach((lineXml, index) => {
    const item: any = { lineNumber: index + 1 };
    const lineNumberStr = extractTag(lineXml, 'lineNumber');
    if (lineNumberStr) item.lineNumber = parseInt(lineNumberStr, 10);
    const lineDescription = extractTag(lineXml, 'lineDescription') || extractTag(lineXml, 'lineNatureIndicator');
    if (lineDescription) item.lineDescription = lineDescription;
    const quantity = extractTag(lineXml, 'quantity');
    if (quantity) item.quantity = parseFloat(quantity);
    const unitOfMeasure = extractTag(lineXml, 'unitOfMeasure') || extractTag(lineXml, 'unitOfMeasureOwn');
    if (unitOfMeasure) item.unitOfMeasure = unitOfMeasure;
    const unitPrice = extractTag(lineXml, 'unitPrice') || extractTag(lineXml, 'unitPriceHUF');
    if (unitPrice) item.unitPrice = parseFloat(unitPrice);

    let vatRate = extractTag(lineXml, 'vatPercentage') || extractTag(lineXml, 'vatRate') || extractTag(lineXml, 'vatExemption');
    if (!vatRate) {
      const vatContentStr = extractTag(lineXml, 'vatContent');
      if (vatContentStr) {
        const vatContentVal = parseFloat(vatContentStr);
        if (!isNaN(vatContentVal)) {
          if (Math.abs(vatContentVal - 0.2126) < 0.005) {
            vatRate = "0.27";
          } else if (Math.abs(vatContentVal - 0.1525) < 0.005) {
            vatRate = "0.18";
          } else if (Math.abs(vatContentVal - 0.0476) < 0.005) {
            vatRate = "0.05";
          } else {
            vatRate = vatContentStr;
          }
        }
      }
    }
    if (vatRate) item.vatRate = vatRate;

    let netAmount = extractTag(lineXml, 'lineNetAmount') || extractTag(lineXml, 'lineNetAmountData');
    let vatAmount = extractTag(lineXml, 'lineVatAmount') || extractTag(lineXml, 'lineVatAmountHUF');
    let grossAmount = extractTag(lineXml, 'lineGrossAmount') || extractTag(lineXml, 'lineGrossAmountData') || extractTag(lineXml, 'lineGrossAmountNormal') || extractTag(lineXml, 'lineGrossAmountNormalHUF') || extractTag(lineXml, 'lineGrossAmountSimplified') || extractTag(lineXml, 'lineGrossAmountSimplifiedHUF');

    if (grossAmount && (!netAmount || !vatAmount)) {
      const grossVal = parseFloat(grossAmount);
      if (!isNaN(grossVal)) {
        if (vatRate) {
          const vatRateVal = parseFloat(vatRate);
          if (!isNaN(vatRateVal) && vatRateVal > 0) {
            const calculatedNet = grossVal / (1 + vatRateVal);
            const calculatedVat = grossVal - calculatedNet;
            if (!netAmount) netAmount = calculatedNet.toFixed(2);
            if (!vatAmount) vatAmount = calculatedVat.toFixed(2);
          } else {
            if (!netAmount) netAmount = grossAmount;
            if (!vatAmount) vatAmount = "0";
          }
        } else {
          if (!netAmount) netAmount = grossAmount;
          if (!vatAmount) vatAmount = "0";
        }
      }
    }

    if (netAmount) item.netAmount = parseFloat(netAmount);
    if (vatAmount) item.vatAmount = parseFloat(vatAmount);
    if (grossAmount) item.grossAmount = parseFloat(grossAmount);

    lineItems.push(item);
  });
  return lineItems;
}

const xml = fs.readFileSync('scratch/victoria_odd.xml', 'utf-8');

const details: any = {};
const supplierName = extractTag(xml, 'supplierName');
if (supplierName) details.supplierName = supplierName;
const supplierAddress = buildAddressString(xml, 'supplierAddress');
if (supplierAddress) details.supplierAddress = supplierAddress;
const customerName = extractTag(xml, 'customerName');
if (customerName) details.customerName = customerName;
const customerAddress = buildAddressString(xml, 'customerAddress');
if (customerAddress) details.customerAddress = customerAddress;
const paymentDate = extractTag(xml, 'paymentDate');
if (paymentDate) details.paymentDate = paymentDate;

let invoiceGrossAmount = extractTag(xml, 'invoiceGrossAmount') || extractTag(xml, 'invoiceGrossAmountHUF');
if (invoiceGrossAmount) {
  details.invoiceGrossAmount = parseFloat(invoiceGrossAmount);
} else {
  const net = extractTag(xml, 'invoiceNetAmount') || extractTag(xml, 'invoiceNetAmountHUF');
  const vat = extractTag(xml, 'invoiceVatAmount') || extractTag(xml, 'invoiceVatAmountHUF');
  if (net) {
    details.invoiceGrossAmount = parseFloat(net) + (vat ? parseFloat(vat) : 0);
  }
}

details.lineItems = parseInvoiceLines(xml);

console.log('Parsed Details:', JSON.stringify(details, null, 2));

let totalNet = 0;
let totalVat = 0;
let totalGross = 0;
details.lineItems.forEach((item: any) => {
  totalNet += item.netAmount || 0;
  totalVat += item.vatAmount || 0;
  totalGross += item.grossAmount || 0;
});

console.log('Totals from items:', { totalNet, totalVat, totalGross });
