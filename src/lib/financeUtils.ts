/**
 * ÁFA és pénzügyi számítási segédfüggvények.
 * Ezek a függvények pure function-ök, könnyen tesztelhetők.
 */

export interface SalaryItem {
  type: string;
  amount: number | null | undefined;
}

/**
 * Kiszámolja az ÁFA pozíciót (fizetendő - levonható).
 * Negatív érték = visszaigényelhető ÁFA.
 */
export function calculateVatPosition(
  outboundVat: number,
  inboundVat: number
): number {
  return outboundVat - inboundVat;
}

/**
 * Szummázza a 'bér' típusú tételek összegét.
 * Null/undefined értékeket 0-ként kezeli.
 */
export function sumNetPayroll(salaryItems: SalaryItem[]): number {
  if (!salaryItems || salaryItems.length === 0) return 0;

  return salaryItems
    .filter((item) => item.type === "bér")
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

/**
 * Deviza átváltás pontos tizedesjegy-kezeléssel (2 tizedes).
 * A lebegőpontos hibák elkerülése érdekében kerekít.
 */
export function convertCurrency(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}
