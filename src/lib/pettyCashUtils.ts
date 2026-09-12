/**
 * Házipénztár segédfüggvények és dinamikus lokalizáció.
 */

export function getLocalizedRegisterName(
  name: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed === 'Központi pénztár') {
    return t('pettyCash:registers.default_name', { defaultValue: 'Központi pénztár' });
  }
  return name;
}

export function getLocalizedEntryDescription(
  desc: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!desc) return '—';

  // Check if starts with "Pénztári bevétel - "
  if (desc.startsWith('Pénztári bevétel - ')) {
    const partner = desc.substring('Pénztári bevétel - '.length).trim();
    const localizedPartner = partner === 'Ismeretlen'
      ? t('pettyCash:entries.unknown_partner', { defaultValue: 'Ismeretlen' })
      : partner;
    return t('pettyCash:entries.auto_desc_outbound', {
      partner: localizedPartner,
      defaultValue: desc,
    });
  }

  // Check if starts with "Pénztári kiadás - "
  if (desc.startsWith('Pénztári kiadás - ')) {
    const partner = desc.substring('Pénztári kiadás - '.length).trim();
    const localizedPartner = partner === 'Ismeretlen'
      ? t('pettyCash:entries.unknown_partner', { defaultValue: 'Ismeretlen' })
      : partner;
    return t('pettyCash:entries.auto_desc_inbound', {
      partner: localizedPartner,
      defaultValue: desc,
    });
  }

  return desc;
}
