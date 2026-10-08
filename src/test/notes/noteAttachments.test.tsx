import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  isAllowedAttachmentFile,
  formatAttachmentSize,
  uploadNoteAttachment,
  deleteNoteAttachment,
  NOTE_ATTACHMENTS_BUCKET,
} from '@/lib/upload-note-attachment';
import { InvoiceAttachmentBadge } from '@/features/invoices/components/table/InvoiceAttachmentBadge';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/storage/v1/object/public/invoice-attachments/file.pdf' },
          }),
          remove: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
      from: vi.fn((table: string) => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'att-123',
                note_id: 'note-1',
                company_id: 'comp-1',
                file_name: 'test.pdf',
                file_path: 'comp-1/note-1/uuid.pdf',
                file_size: 1024,
                mime_type: 'application/pdf',
                public_url: 'https://example.com/storage/v1/object/public/invoice-attachments/file.pdf',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    },
  };
});

describe('Note Attachments - Utility Functions', () => {
  it('correctly validates allowed file types', () => {
    const validPdf = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });
    const validPng = new File(['dummy content'], 'receipt.png', { type: 'image/png' });
    const validJpeg = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' });
    const validWebp = new File(['dummy content'], 'image.webp', { type: 'image/webp' });

    expect(isAllowedAttachmentFile(validPdf)).toBe(true);
    expect(isAllowedAttachmentFile(validPng)).toBe(true);
    expect(isAllowedAttachmentFile(validJpeg)).toBe(true);
    expect(isAllowedAttachmentFile(validWebp)).toBe(true);

    const invalidExe = new File(['dummy content'], 'malware.exe', { type: 'application/x-msdownload' });
    const invalidZip = new File(['dummy content'], 'archive.zip', { type: 'application/zip' });
    const invalidText = new File(['dummy content'], 'notes.txt', { type: 'text/plain' });

    expect(isAllowedAttachmentFile(invalidExe)).toBe(false);
    expect(isAllowedAttachmentFile(invalidZip)).toBe(false);
    expect(isAllowedAttachmentFile(invalidText)).toBe(false);
  });

  it('formats attachment file sizes correctly', () => {
    expect(formatAttachmentSize(500)).toBe('500 B');
    expect(formatAttachmentSize(1024)).toBe('1.0 KB');
    expect(formatAttachmentSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});

describe('Note Attachments - Upload and Delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects files exceeding 20 MB', async () => {
    const hugeFile = new File([''], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(hugeFile, 'size', { value: 25 * 1024 * 1024 });

    await expect(uploadNoteAttachment(hugeFile, 'comp-1', 'note-1')).rejects.toThrow(
      'A fájl mérete nem haladhatja meg a 20 MB-ot'
    );
  });

  it('successfully uploads valid PDF to Supabase Storage and records metadata', async () => {
    const validPdf = new File(['sample content'], 'tig_igazolas.pdf', { type: 'application/pdf' });
    const result = await uploadNoteAttachment(validPdf, 'comp-1', 'note-1');

    expect(result).toBeDefined();
    expect(result.id).toBe('att-123');
    expect(result.file_name).toBe('test.pdf');
  });
});

describe('InvoiceAttachmentBadge Component', () => {
  it('renders reserved placeholder when count is 0 and reserveSpace is true', () => {
    const { container } = render(
      <TooltipProvider>
        <InvoiceAttachmentBadge count={0} reserveSpace={true} />
      </TooltipProvider>
    );
    const placeholder = container.querySelector('[aria-hidden="true"]');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder?.className).toContain('w-[30px]');
  });

  it('renders nothing when count is 0 and reserveSpace is false', () => {
    const { container } = render(
      <TooltipProvider>
        <InvoiceAttachmentBadge count={0} reserveSpace={false} />
      </TooltipProvider>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders badge with count when attachments exist', () => {
    render(
      <TooltipProvider>
        <InvoiceAttachmentBadge count={3} />
      </TooltipProvider>
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('applies emerald highlight badge style when hasTig is true', () => {
    const { container } = render(
      <TooltipProvider>
        <InvoiceAttachmentBadge count={2} hasTig={true} />
      </TooltipProvider>
    );

    const badge = container.querySelector('span');
    expect(badge).toBeInTheDocument();
    expect(badge?.className).toContain('bg-emerald-500/15');
  });
});
