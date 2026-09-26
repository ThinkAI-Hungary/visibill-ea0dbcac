import { PurchaseVoucher, PurchaseVoucherItem, PurchaseVouchersSummary, PurchaseVoucherFormData } from './types';

/**
 * Calculates net, compensation surcharge, and gross amount for a single line item.
 *
 * In Hungarian tax law (Áfa tv. 199. §):
 * - Plant / crop / forestry products: 12% compensation surcharge
 * - Livestock / animal products: 7% compensation surcharge
 */
export function calculateItemTotals(
  quantity: number,
  unitPrice: number,
  compensationRate: number
): { net_amount: number; compensation_amount: number; gross_amount: number } {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const rate = Number(compensationRate) || 0;

  const net_amount = Math.round(qty * price * 100) / 100;
  const compensation_amount = Math.round(((net_amount * rate) / 100) * 100) / 100;
  const gross_amount = Math.round((net_amount + compensation_amount) * 100) / 100;

  return {
    net_amount,
    compensation_amount,
    gross_amount,
  };
}

/**
 * Calculates aggregate totals for a voucher header from its line items.
 */
export function calculateVoucherTotals(
  items: Array<{ quantity: number; unit_price: number }>,
  compensationRate: number,
  taxDeducted: number = 0
): { net: number; compensation: number; gross: number } {
  let netSum = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    netSum += Math.round(qty * price * 100) / 100;
  }
  netSum = Math.round(netSum * 100) / 100;

  const compRate = Number(compensationRate) || 0;
  const compSum = Math.round(((netSum * compRate) / 100) * 100) / 100;
  const tax = Number(taxDeducted) || 0;
  const grossSum = Math.round((netSum + compSum - tax) * 100) / 100;

  return {
    net: netSum,
    compensation: compSum,
    gross: grossSum,
  };
}

/**
 * Calculates summary metrics across an array of vouchers.
 */
export function calculateVouchersSummary(vouchers: PurchaseVoucher[]): PurchaseVouchersSummary {
  let totalNet = 0;
  let totalCompensation = 0;
  let totalGross = 0;
  let unpaidGross = 0;
  let paidGross = 0;
  const producers = new Set<string>();

  for (const v of vouchers) {
    totalNet += Number(v.net_amount) || 0;
    totalCompensation += Number(v.compensation_surcharge_amount) || 0;
    totalGross += Number(v.gross_amount) || 0;

    if (v.payment_status === 'paid') {
      paidGross += Number(v.gross_amount) || 0;
    } else {
      unpaidGross += Number(v.gross_amount) || 0;
    }

    const producerIdentifier = (v.producer_tax_id || v.producer_name || '').trim().toLowerCase();
    if (producerIdentifier) {
      producers.add(producerIdentifier);
    }
  }

  return {
    total_count: vouchers.length,
    total_net: Math.round(totalNet * 100) / 100,
    total_compensation: Math.round(totalCompensation * 100) / 100,
    total_gross: Math.round(totalGross * 100) / 100,
    unpaid_gross: Math.round(unpaidGross * 100) / 100,
    paid_gross: Math.round(paidGross * 100) / 100,
    unique_producers: producers.size,
  };
}

/**
 * Filters vouchers according to search query and status.
 */
export function filterVouchers(
  vouchers: PurchaseVoucher[],
  options: { search?: string; statusFilter?: 'all' | 'unpaid' | 'paid' }
): PurchaseVoucher[] {
  const { search = '', statusFilter = 'all' } = options;
  const query = search.trim().toLowerCase();

  return vouchers.filter((v) => {
    if (statusFilter !== 'all' && v.payment_status !== statusFilter) {
      return false;
    }

    if (query) {
      const matchesNumber = v.voucher_number.toLowerCase().includes(query);
      const matchesProducer = v.producer_name.toLowerCase().includes(query);
      const matchesTaxId = v.producer_tax_id ? v.producer_tax_id.toLowerCase().includes(query) : false;
      const matchesCard = v.producer_card_number ? v.producer_card_number.toLowerCase().includes(query) : false;
      const matchesItems = v.items?.some((i) => i.item_name.toLowerCase().includes(query)) || false;

      if (!matchesNumber && !matchesProducer && !matchesTaxId && !matchesCard && !matchesItems) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Validates purchase voucher form data.
 */
export function validateVoucherForm(formData: Partial<PurchaseVoucherFormData>): {
  isValid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!formData.voucher_number?.trim()) {
    errors.voucher_number = 'A bizonylatszám kötelező.';
  }

  if (!formData.producer_name?.trim()) {
    errors.producer_name = 'Az őstermelő neve kötelező.';
  }

  if (!formData.fulfillment_date) {
    errors.fulfillment_date = 'A teljesítés dátuma kötelező.';
  }

  if (!formData.items || formData.items.length === 0) {
    errors.items = 'Legalább egy tételt meg kell adni.';
  } else {
    formData.items.forEach((item, index) => {
      if (!item.item_name?.trim()) {
        errors[`item_${index}_name`] = 'A tétel megnevezése kötelező.';
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        errors[`item_${index}_quantity`] = 'A mennyiségnek nagyobbnak kell lennie 0-nál.';
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
