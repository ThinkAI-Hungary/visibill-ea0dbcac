/**
 * Tranzakció típusok és címkék lokalizációs segédfüggvényei.
 */

export function getTransactionTypeKey(type: string | null | undefined): string | null {
  if (!type) return null;
  const t = type.toLowerCase().trim();

  switch (t) {
    case 'szállítói tranzakció':
    case 'szállító':
    case 'supplier':
      return 'supplier';
    case 'vevői tranzakció':
    case 'vevő':
    case 'customer':
      return 'customer';
    case 'bankköltség':
    case 'bank_cost':
      return 'bank_cost';
    case 'banki számlavezetési díj':
    case 'bank_fee':
      return 'bank_fee';
    case 'kártyadíj':
    case 'card_fee':
      return 'card_fee';
    case 'számlák közötti átvezetés':
    case 'transfer':
      return 'transfer';
    case 'kamatjövedelem':
    case 'interest_income':
      return 'interest_income';
    case 'kamatjóváírás':
    case 'interest_credit':
      return 'interest_credit';
    case 'kamat':
    case 'interest':
      return 'interest';
    case 'járulékkiadások':
    case 'tax_expense':
      return 'tax_expense';
    case 'járulékok/adók':
    case 'taxes':
      return 'taxes';
    case 'bérek':
    case 'bér':
    case 'salary':
      return 'salary';
    case 'hiteltörlesztés':
    case 'loan':
      return 'loan';
    case 'tranzakciós illeték':
    case 'transaction_tax':
      return 'transaction_tax';
    case 'atm pénzfelvét':
    case 'atm_withdrawal':
      return 'atm_withdrawal';
    case 'atm készpénzfelvét':
    case 'atm_cash_withdrawal':
      return 'atm_cash_withdrawal';
    case 'pénztári kp felvét':
    case 'cash_withdrawal':
      return 'cash_withdrawal';
    case 'pénztári kp befizetés':
    case 'cash_deposit':
      return 'cash_deposit';
    case 'kp befizetés atm-en keresztül':
    case 'atm_cash_deposit':
      return 'atm_cash_deposit';
    case 'fizetés':
    case 'payment':
      return 'payment';
    case 'kézi kiadás':
    case 'manual_expense':
      return 'manual_expense';
    default:
      return null;
  }
}

export function getTransactionTypeLabel(
  type: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!type) return '';
  const key = getTransactionTypeKey(type);
  if (key) {
    return t(`transactions:types.${key}`, { defaultValue: type });
  }
  return type;
}
