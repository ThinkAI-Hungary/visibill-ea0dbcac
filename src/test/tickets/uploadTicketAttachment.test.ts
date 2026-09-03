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
