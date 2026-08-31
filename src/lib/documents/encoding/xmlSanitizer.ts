/**
 * XML Sanitization and ÁNYK (NAV) XML formatting utilities.
 */

/**
 * Escapes special XML characters to prevent syntax errors and XML injection.
 */
export function escapeXml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds an XML element string with optional attributes and nested value.
 */
export function buildXmlTag(
  tagName: string,
  value?: unknown,
  attributes?: Record<string, string | number | boolean | null | undefined>
): string {
  let attrStr = '';
  if (attributes) {
    const pairs = Object.entries(attributes)
      .filter(([_, v]) => v != null)
      .map(([k, v]) => `${k}="${escapeXml(v)}"`);
    if (pairs.length > 0) {
      attrStr = ' ' + pairs.join(' ');
    }
  }

  if (value == null || value === '') {
    return `<${tagName}${attrStr}/>`;
  }

  return `<${tagName}${attrStr}>${escapeXml(value)}</${tagName}>`;
}

/**
 * Builds a standard ÁNYK XML envelope with header and form declaration.
 */
export interface AnykHeaderOptions {
  formId: string; // e.g. '2665' or '2658'
  formVersion: string; // e.g. '1.0'
  softwareName?: string; // default: 'Visibill / eaisyBooks'
  taxNumber?: string;
  periodYear?: number;
  periodMonth?: number;
}

export function buildAnykEnvelope(
  options: AnykHeaderOptions,
  bodyXml: string
): string {
  const software = options.softwareName || 'Visibill / eaisyBooks';
  return `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvanyok xmlns="http://schema.nav.gov.hu/anyk/1.0">
  <nyomtatvany>
    <nyomtatvanyinformacio>
      <nyomtatvanyazonosito>${escapeXml(options.formId)}</nyomtatvanyazonosito>
      <nyomtatvanyverzio>${escapeXml(options.formVersion)}</nyomtatvanyverzio>
      <programnev>${escapeXml(software)}</programnev>
    </nyomtatvanyinformacio>
    <mezok>
${bodyXml}
    </mezok>
  </nyomtatvany>
</nyomtatvanyok>`;
}
