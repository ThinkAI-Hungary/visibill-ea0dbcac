/**
 * Dinamikus státusz logika segédfüggvények.
 */

/**
 * Meghatározza a fizetési státuszt a tranzakció ID alapján.
 * - Ha van tranzakció ID → "Kifizetve"
 * - Ha nincs (null/undefined/"") → "Nyitott"
 */
export function computePaymentStatus(
  transactionId: string | null | undefined
): "Kifizetve" | "Nyitott" {
  return transactionId ? "Kifizetve" : "Nyitott";
}
