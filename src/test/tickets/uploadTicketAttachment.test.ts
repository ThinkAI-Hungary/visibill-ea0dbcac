import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isAllowedTicketFile, uploadTicketImage, ALLOWED_TYPES } from '@/lib/upload-ticket-image';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/storage/v1/object/public/ticket-attachments/test/file.xml' } }),
      })),
    },
  },
}));

describe('upload-ticket-image XML support', () => {
  it('includes XML MIME types in ALLOWED_TYPES', () => {
    expect(ALLOWED_TYPES).toContain('application/xml');
    expect(ALLOWED_TYPES).toContain('text/xml');
  });

  it('allows XML files with application/xml MIME type', () => {
    const file = new File(['<xml></xml>'], 'bevallas_2608.xml', { type: 'application/xml' });
    expect(isAllowedTicketFile(file)).toBe(true);
  });

  it('allows XML files with text/xml MIME type', () => {
    const file = new File(['<xml></xml>'], 'anyk_export.xml', { type: 'text/xml' });
    expect(isAllowedTicketFile(file)).toBe(true);
  });

  it('allows XML files even if browser sends empty or octet-stream MIME type based on .xml extension', () => {
    const file = new File(['<xml></xml>'], 'januar_2608.xml', { type: '' });
    expect(isAllowedTicketFile(file)).toBe(true);

    const fileUpper = new File(['<xml></xml>'], 'JANUAR_2608.XML', { type: 'application/octet-stream' });
    expect(isAllowedTicketFile(fileUpper)).toBe(true);
  });

  it('rejects forbidden file types like .exe or .sh', () => {
    const file = new File(['echo hi'], 'script.exe', { type: 'application/x-msdownload' });
    expect(isAllowedTicketFile(file)).toBe(false);
  });

  it('successfully uploads an XML file via uploadTicketImage with proper contentType', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: uploadMock,
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/storage/v1/object/public/ticket-attachments/test/file.xml' } }),
    } as any);

    const file = new File(['<xml></xml>'], '2608_januar.xml', { type: '' });
    const url = await uploadTicketImage(file, 'user-123', 'ticket-456');
    expect(url).toContain('file.xml');
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/ticket-456\/user-123\/.*\.xml$/),
      file,
      expect.objectContaining({
        contentType: 'application/xml',
      })
    );
  });
});

describe('upload-ticket-image Markdown (.md) support', () => {
  it('includes Markdown MIME types in ALLOWED_TYPES and extensions', () => {
    expect(ALLOWED_TYPES).toContain('text/markdown');
    expect(ALLOWED_TYPES).toContain('text/x-markdown');
  });

  it('allows .md files based on extension even if type is empty or text/plain', () => {
    const file1 = new File(['# Bug report'], 'hibajegy_leiras.md', { type: '' });
    expect(isAllowedTicketFile(file1)).toBe(true);

    const file2 = new File(['# Specification'], 'specifikacio.MD', { type: 'text/plain' });
    expect(isAllowedTicketFile(file2)).toBe(true);

    const file3 = new File(['# Readme'], 'README.markdown', { type: 'text/markdown' });
    expect(isAllowedTicketFile(file3)).toBe(true);
  });

  it('uploads .md file with text/markdown contentType', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    const uploadMock = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.storage.from).mockReturnValue({
      upload: uploadMock,
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/storage/v1/object/public/ticket-attachments/test/file.md' } }),
    } as any);

    const file = new File(['# Hiba'], 'leiras.md', { type: '' });
    const url = await uploadTicketImage(file, 'user-123', 'ticket-456');
    expect(url).toContain('file.md');
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/ticket-456\/user-123\/.*\.md$/),
      file,
      expect.objectContaining({
        contentType: 'text/markdown; charset=utf-8',
      })
    );
  });
});

describe('upload-ticket-image clipboard paste helpers', () => {
  it('extracts files from clipboardData.items (Ctrl+V image screenshot)', async () => {
    const { extractFilesFromClipboard } = await import('@/lib/upload-ticket-image');
    const imageBlob = new File(['binary-png-data'], 'image.png', { type: 'image/png' });
    const fakeEvent = {
      clipboardData: {
        files: [],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => imageBlob,
          },
        ],
      },
    } as any;

    const extracted = extractFilesFromClipboard(fakeEvent);
    expect(extracted.length).toBe(1);
    expect(extracted[0].type).toBe('image/png');
    expect(extracted[0].name).toMatch(/^beillesztett_kep_/);
  });

  it('extracts files from clipboardData.files', async () => {
    const { extractFilesFromClipboard } = await import('@/lib/upload-ticket-image');
    const mdFile = new File(['# Leiras'], 'doc.md', { type: 'text/markdown' });
    const fakeEvent = {
      clipboardData: {
        files: [mdFile],
      },
    } as any;

    const extracted = extractFilesFromClipboard(fakeEvent);
    expect(extracted.length).toBe(1);
    expect(extracted[0].name).toBe('doc.md');
  });
});

