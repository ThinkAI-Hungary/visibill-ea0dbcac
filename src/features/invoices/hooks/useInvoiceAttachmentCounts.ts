import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InvoiceAttachmentInfo {
  count: number;
  hasTig: boolean;
}

export function useInvoiceAttachmentCounts(companyId: string | undefined) {
  return useQuery<Record<string, InvoiceAttachmentInfo>>({
    queryKey: ['invoice-attachment-counts', companyId],
    queryFn: async () => {
      if (!companyId) return {};

      const { data, error } = await supabase
        .from('note_attachments')
        .select(`
          id,
          file_name,
          note_id,
          notes!inner (
            invoice_id,
            invoice_ids
          )
        `)
        .eq('company_id', companyId);

      if (error) {
        console.warn('Error fetching invoice attachment counts:', error);
        return {};
      }

      const map: Record<string, InvoiceAttachmentInfo> = {};

      (data || []).forEach((att: any) => {
        const note = att.notes;
        if (!note) return;

        const linkedIds = new Set<string>();
        if (note.invoice_id) linkedIds.add(note.invoice_id);
        if (Array.isArray(note.invoice_ids)) {
          note.invoice_ids.forEach((id: string) => {
            if (id) linkedIds.add(id);
          });
        }

        const isTig =
          att.file_name.toLowerCase().includes('tig') ||
          att.file_name.toLowerCase().includes('teljesites');

        linkedIds.forEach((invId) => {
          if (!map[invId]) {
            map[invId] = { count: 0, hasTig: false };
          }
          map[invId].count += 1;
          if (isTig) {
            map[invId].hasTig = true;
          }
        });
      });

      return map;
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}
