import { HU_GL_NAME_TO_KEY, normalizeGlAccountName, normalizeGlKey } from './glAccountDictionary';

/**
 * Főkönyvi számlák és számlaosztályok lokalizációs segédfüggvényei.
 */
export function getLocalizedGlAccountName(
  glNumber: string | null | undefined,
  name: string | null | undefined,
  t?: (key: any, ...args: any[]) => any
): string {
  if (!name && !glNumber) return '';
  const trimmedName = (name || '').trim();
  const num = (glNumber || '').trim().replace(/\.$/, '');

  // 1. Root classes (0-9)
  // Check either by glNumber ('0', '1', '2', etc.) or if name contains class indicator
  if (
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(num) ||
    trimmedName.toUpperCase().startsWith('SZÁMLAOSZTÁLY:') ||
    trimmedName.toUpperCase().startsWith('RAZRED KONTA:')
  ) {
    let classNum = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(num) ? num : null;
    if (!classNum) {
      const match =
        trimmedName.match(/^SZ[AÁ]MLAOSZT[AÁ]LY:\s*(\d)\.?/i) ||
        trimmedName.match(/(\d)\.?\s*SZ[AÁ]MLAOSZT[AÁ]LY/i) ||
        trimmedName.match(/^RAZRED\s+KONTA:\s*(\d)\.?/i) ||
        trimmedName.match(/(\d)\.?\s*RAZRED\s+KONTA/i);
      if (match) {
        classNum = match[1];
      }
    }

    if (classNum && t) {
      const translationKey = `accounting:general_ledger.gl_classes.${classNum}`;
      const translated = t(translationKey, { defaultValue: '' });
      if (translated) {
        return translated;
      }
    }
  }

  // 2. Custom account name starting with SZÁMLAOSZTÁLY:
  if (trimmedName.toUpperCase().startsWith('SZÁMLAOSZTÁLY:')) {
    const rest = trimmedName.substring('SZÁMLAOSZTÁLY:'.length).trim();
    const prefix = t ? t('accounting:general_ledger.gl_classes.prefix', { defaultValue: 'SZÁMLAOSZTÁLY:' }) : 'SZÁMLAOSZTÁLY:';
    return `${prefix} ${rest}`;
  }

  // 3. Match standard account by glNumber (e.g. '311.', '311', '41.', '411.', '17-19.', etc.)
  if (glNumber && t) {
    const safeKey = normalizeGlKey(glNumber);
    const translationKey = `accounting:general_ledger.accounts.${safeKey}`;
    const translated = t(translationKey, { defaultValue: '' });
    if (translated) {
      return translated;
    }
  }

  // 4. Match standard account by Hungarian name
  if (trimmedName && t) {
    const norm = normalizeGlAccountName(trimmedName);
    const keyByName = HU_GL_NAME_TO_KEY[norm];
    if (keyByName) {
      const translationKey = `accounting:general_ledger.accounts.${keyByName}`;
      const translated = t(translationKey, { defaultValue: '' });
      if (translated) {
        return translated;
      }
    }
  }

  return trimmedName || glNumber || '';
}
