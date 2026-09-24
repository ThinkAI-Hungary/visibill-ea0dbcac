/**
 * Hibajegy kategóriák definíciója és típusai.
 * Választható kategóriák a számlázási, könyvelési és rendszer folyamatokhoz.
 */

export const TICKET_CATEGORIES = [
  "áfa",
  "bank napló",
  "banki tranzakciók",
  "bér xml",
  "bérjegyzék",
  "dolgozói törzsadat",
  "egyéb",
  "főkönyv",
  "napló számlák",
  "nyitó napló",
  "partner",
  "pénztár tranzakciók",
  "rendszer",
  "SUP",
  "számla feldolgozás",
  "számlaképek",
  "vegyes napló",
  "szállító napló",
  "vevő napló",
  "bér napló",
  "pénztár napló",
  "záró tételek napló",
  "vevő-szállító analitika",
  "előleg analitika",
  "árfolyam elszámolás",
  "elhatárolások",
  "devizás könyvelés",
  "tárgyi eszköz",
  "egyszeres számla tranzakciók",
  "egyszeres számla könyvelés",
  "egyszeres banki tranzakciók",
  "egyszeres bank könyvelés",
  "egyszeres pénztár tranzakciók",
  "egyszeres pénztár könyvelés",
  "egyszeres áfa",
  "egyszeres pénztárkönyv",
  "besorolandó",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/**
 * Ellenőrzi, hogy egy adott string érvényes hibajegy kategória-e.
 */
export function isValidTicketCategory(cat: string | null | undefined): cat is TicketCategory {
  if (!cat) return false;
  return (TICKET_CATEGORIES as readonly string[]).includes(cat);
}
