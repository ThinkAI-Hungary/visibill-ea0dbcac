/**
 * Central DocumentEngine Facade.
 * Coordinates document descriptors, encoding, lazy-loaded library adapters,
 * and client-side browser downloads / previews.
 */

import { DocumentDescriptor, ExportFormat, ExportResult } from './types';
import { downloadBlob, downloadString, createPreviewBlobUrl } from './downloadHelper';
import { PdfDocumentAdapter } from '../adapters/PdfDocumentAdapter';
import { XmlDocumentAdapter } from '../adapters/XmlDocumentAdapter';
import { SpreadsheetAdapter } from '../adapters/SpreadsheetAdapter';
import { HtmlPreviewAdapter } from '../adapters/HtmlPreviewAdapter';

export class DocumentEngine {
  /**
   * Renders a document descriptor into a binary Blob or content string based on the requested format.
   */
  public static async render(
    descriptor: DocumentDescriptor,
    format: ExportFormat
  ): Promise<{ blob?: Blob; contentString?: string; mimeType: string }> {
    switch (format) {
      case 'pdf': {
        const blob = await PdfDocumentAdapter.renderToBlob(descriptor);
        return { blob, mimeType: 'application/pdf' };
      }
      case 'xml': {
        const contentString = XmlDocumentAdapter.renderToString(descriptor);
        return { contentString, mimeType: 'application/xml;charset=utf-8' };
      }
      case 'csv': {
        const contentString = SpreadsheetAdapter.renderToCsv(descriptor);
        return { contentString, mimeType: 'text/csv;charset=utf-8' };
      }
      case 'xlsx': {
        const blob = await SpreadsheetAdapter.renderToXlsxBlob(descriptor);
        return { blob, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
      }
      case 'html': {
        const contentString = HtmlPreviewAdapter.renderToHtml(descriptor);
        return { contentString, mimeType: 'text/html;charset=utf-8' };
      }
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Renders and immediately triggers a browser download for the generated document.
   */
  public static async export(
    descriptor: DocumentDescriptor,
    format: ExportFormat,
    customFilename?: string
  ): Promise<ExportResult> {
    const timestamp = new Date().toISOString().slice(0, 10);
    const baseName = customFilename || descriptor.metadata.filename || descriptor.metadata.title.toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
    const filename = baseName.endsWith(`.${format}`) ? baseName : `${baseName}_${timestamp}.${format}`;

    try {
      const { blob, contentString, mimeType } = await this.render(descriptor, format);

      if (blob) {
        downloadBlob(blob, filename);
        return {
          filename,
          format,
          blob,
          success: true,
          sizeBytes: blob.size,
        };
      } else if (contentString != null) {
        const addBom = format === 'csv';
        downloadString(contentString, filename, mimeType, addBom);
        return {
          filename,
          format,
          contentString,
          success: true,
          sizeBytes: new Blob([contentString]).size,
        };
      }

      return { filename, format, success: false };
    } catch (error) {
      console.error(`[DocumentEngine] Export failed for ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Generates a preview HTML document and opens it in a printable new browser tab.
   */
  public static previewInNewTab(descriptor: DocumentDescriptor): Window | null {
    if (typeof window === 'undefined') return null;
    const html = HtmlPreviewAdapter.renderToHtml(descriptor);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
    return printWindow;
  }

  /**
   * Creates an ephemeral Object URL for previewing in an iframe.
   */
  public static createPreviewUrl(descriptor: DocumentDescriptor): string {
    const html = HtmlPreviewAdapter.renderToHtml(descriptor);
    return createPreviewBlobUrl(html, 'text/html;charset=utf-8');
  }
}
