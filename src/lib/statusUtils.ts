/**
 * Dinamikus státusz logika segédfüggvények.
 */

/**
 * Meghatározza a fizetési státuszt a tranzakció ID alapján.
 * - Ha van tranzakció ID → "Kifizetve"
 * - Ha nincs (null/undefined/"") → "Nyitott"
 */
export function computePaymentStatus(
  transactionId: string | null | undefined,
  matchStatus?: string | null
): "Kifizetve" | "Részben fizetve" | "Nyitott" {
  if (matchStatus === 'partially_paid') return "Részben fizetve";
  return transactionId ? "Kifizetve" : "Nyitott";
}
