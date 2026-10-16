/**
 * Beruházási Adókedvezmény és 4 Éves Kivezetési Gát Szolgáltatás (Tao. tv. 22/B. §, 7. §)
 */

export interface TaxCreditRestrictionCheckParams {
  hasTaxCredit?: boolean | null;
  taxCreditType?: string | null;
  taxCreditRetentionUntil?: string | null;
  activationDate?: string | null;
  disposalDate: string; // ISO format: YYYY-MM-DD
}

export interface TaxCreditRestrictionCheckResult {
  restricted: boolean;
  retentionUntil: string | null;
  daysRemaining: number;
  reasonMessage?: string;
}

/**
 * Kiszámolja a megtartási kötelezettség alapértelmezett lejárati dátumát (aktiválás + 4 naptári év)
 */
export function calculateDefaultTaxCreditRetentionUntil(activationDate: string): string {
  if (!activationDate) return '';
  const parts = activationDate.split('-');
  if (parts.length !== 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parts[1];
  const day = parts[2];
  if (isNaN(year)) return '';
  return `${year + 4}-${month}-${day}`;
}

/**
 * Ellenőrzi, hogy a kivezetés a beruházási adókedvezmény megtartási időszakán belül történik-e
 */
export function checkTaxCreditAlienationRestriction(
  params: TaxCreditRestrictionCheckParams
): TaxCreditRestrictionCheckResult {
  if (!params.hasTaxCredit) {
    return {
      restricted: false,
      retentionUntil: null,
      daysRemaining: 0,
    };
  }

  const effectiveRetentionUntil =
    params.taxCreditRetentionUntil ||
    (params.activationDate ? calculateDefaultTaxCreditRetentionUntil(params.activationDate) : null);

  if (!effectiveRetentionUntil || !params.disposalDate) {
    return {
      restricted: false,
      retentionUntil: effectiveRetentionUntil,
      daysRemaining: 0,
    };
  }

  // Összehasonlítás ISO string szerint lexikografikusan (YYYY-MM-DD)
  const isBeforeRetention = params.disposalDate < effectiveRetentionUntil;

  if (!isBeforeRetention) {
    return {
      restricted: false,
      retentionUntil: effectiveRetentionUntil,
      daysRemaining: 0,
    };
  }

  // Hátralévő napok kalkulációja
  const dispTime = new Date(params.disposalDate).getTime();
  const retTime = new Date(effectiveRetentionUntil).getTime();
  const diffDays = Math.max(1, Math.ceil((retTime - dispTime) / (1000 * 60 * 60 * 24)));

  return {
    restricted: true,
    retentionUntil: effectiveRetentionUntil,
    daysRemaining: diffDays,
    reasonMessage: `Az eszköz beruházási adókedvezménnyel érintett, a törvényi megtartási kötelezettség lejárati dátuma: ${effectiveRetentionUntil} (még ${diffDays} nap). A védelmi időszakon belüli kivezetés adóalap-növelési és késedelmi pótlék fizetési kötelezettséggel járhat!`,
  };
}
