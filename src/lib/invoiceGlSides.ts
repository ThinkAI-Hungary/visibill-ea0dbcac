/**
 * Utility for determining double-entry Tartozik (Debit) and Követel (Credit) sides
 * for invoice line items in accordance with Hungarian accounting standards.
 *
 * Rules:
 * 1. INBOUND (Szállítói számlák):
 *    - Positive item (standard expense):
 *      Tartozik (T): Költség / Ráfordítás (pl. 511, 529, 211)
 *      Követel (K):  Szállítói kötelezettség (pl. 4541, 4542)
 *    - Negative item (stornó / jóváíró / engedmény):
 *      Tartozik (T): Szállítói kötelezettség csökkenése (pl. 4541)
 *      Követel (K):  Költség csökkenése (pl. 511)
 *
 * 2. OUTBOUND (Vevői számlák):
 *    - Positive item (standard sales):
 *      Tartozik (T): Vevőkövetelés (pl. 311, 312)
 *      Követel (K):  Árbevétel (pl. 911)
 *    - Negative item (vevői jóváírás / stornó):
 *      Tartozik (T): Árbevétel csökkenése (pl. 911)
 *      Követel (K):  Vevőkövetelés csökkenése (pl. 311)
 *
 * 3. Manual override (T ↔ K swap):
 *    - When isSwapped is true, Tartozik and Követel sides are inverted.
 */

export interface InvoiceItemGlInput {
  net_amount?: number | null;
  gross_amount?: number | null;
  vat_amount?: number | null;
}

export interface DebitCreditSidesResult {
  isNegative: boolean;
  debitGl: string;
  creditGl: string;
  debitRole: string;
  creditRole: string;
  debitIsItem: boolean;
  creditIsItem: boolean;
  isSwapped: boolean;
}

export function computeLineItemDebitCreditSides(params: {
  item: InvoiceItemGlInput;
  isOutbound: boolean;
  netGl?: string | null;
  partnerGl: string;
  isSwapped?: boolean;
}): DebitCreditSidesResult {
  const { item, isOutbound, netGl, partnerGl, isSwapped = false } = params;
  const isNegative = (item.net_amount ?? 0) < 0 || (item.gross_amount ?? 0) < 0;

  let naturalDebitGl: string;
  let naturalCreditGl: string;
  let naturalDebitRole: string;
  let naturalCreditRole: string;
  let naturalDebitIsItem: boolean;
  let naturalCreditIsItem: boolean;

  if (isOutbound) {
    if (!isNegative) {
      naturalDebitGl = partnerGl;
      naturalCreditGl = netGl || '-';
      naturalDebitRole = 'Vevőkövetelés';
      naturalCreditRole = 'Árbevétel';
      naturalDebitIsItem = false;
      naturalCreditIsItem = true;
    } else {
      naturalDebitGl = netGl || '-';
      naturalCreditGl = partnerGl;
      naturalDebitRole = 'Árbevétel csökkenése';
      naturalCreditRole = 'Vevőkövetelés csökkenése';
      naturalDebitIsItem = true;
      naturalCreditIsItem = false;
    }
  } else {
    if (!isNegative) {
      naturalDebitGl = netGl || '-';
      naturalCreditGl = partnerGl;
      naturalDebitRole = 'Költség / Ráfordítás';
      naturalCreditRole = 'Szállítói kötelezettség';
      naturalDebitIsItem = true;
      naturalCreditIsItem = false;
    } else {
      naturalDebitGl = partnerGl;
      naturalCreditGl = netGl || '-';
      naturalDebitRole = 'Szállítói kötelezettség csökkenése';
      naturalCreditRole = 'Költség csökkenése';
      naturalDebitIsItem = false;
      naturalCreditIsItem = true;
    }
  }

  return {
    isNegative,
    debitGl: isSwapped ? naturalCreditGl : naturalDebitGl,
    creditGl: isSwapped ? naturalDebitGl : naturalCreditGl,
    debitRole: isSwapped ? naturalCreditRole : naturalDebitRole,
    creditRole: isSwapped ? naturalDebitRole : naturalCreditRole,
    debitIsItem: isSwapped ? naturalCreditIsItem : naturalDebitIsItem,
    creditIsItem: isSwapped ? naturalDebitIsItem : naturalCreditIsItem,
    isSwapped,
  };
}
