/**
 * XML Document Adapter for DocumentEngine.
 * Handles ÁNYK and standard XML exports.
 */

import { DocumentDescriptor } from '../core/types';
import { buildAnykEnvelope, escapeXml, buildXmlTag } from '../encoding/xmlSanitizer';

export class XmlDocumentAdapter {
  /**
   * Renders a document descriptor with XML payload into an XML string.
   */
  public static renderToString(descriptor: DocumentDescriptor): string {
    const raw = descriptor.rawPayload || {};

    if (raw.customXml) {
      return raw.customXml;
    }

    if (raw.anykOptions) {
      const fieldXml = Object.entries(raw.fields || {})
        .map(([key, val]) => `      ${buildXmlTag(key, val)}`)
        .join('\n');
      return buildAnykEnvelope(raw.anykOptions, fieldXml);
    }

    // Default XML serialization from sections
    const sectionXml = descriptor.sections.map(s => {
      if (s.type === 'table') {
        const headers = s.headers || [];
        const rowsXml = s.rows.map(r => {
          const cells = r.map((c, i) => `      <col_${i + 1}>${escapeXml(c)}</col_${i + 1}>`).join('\n');
          return `    <row>\n${cells}\n    </row>`;
        }).join('\n');
        return `  <table title="${escapeXml(s.title || '')}">\n    <headers>${headers.map(h => escapeXml(h)).join(',')}</headers>\n${rowsXml}\n  </table>`;
      }
      if (s.type === 'key-value') {
        const items = s.items.map(it => `    <item label="${escapeXml(it.label)}">${escapeXml(it.value)}</item>`).join('\n');
        return `  <group title="${escapeXml(s.title || '')}">\n${items}\n  </group>`;
      }
      return '';
    }).filter(Boolean).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<document title="${escapeXml(descriptor.metadata.title)}" company="${escapeXml(descriptor.metadata.companyName || '')}" period="${escapeXml(descriptor.metadata.period || '')}">
${sectionXml}
</document>`;
  }
}
