import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Note } from '@/types/notes';

export function useNotesData(companyId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading, refetch } = useQuery({
    queryKey: ['notes', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select(`
          id,
          company_id,
          user_id,
          title,
          content,
          is_private,
          invoice_id,
          invoice_ids,
          created_at,
          updated_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;
      if (!notesData || notesData.length === 0) return [];

      // Collect user ids for profiles lookup
      const userIds = Array.from(new Set(notesData.map(n => n.user_id)));

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map<string, string>();
      if (profilesData) {
        profilesData.forEach(p => {
          profileMap.set(p.user_id, p.name || 'Névtelen');
        });
      }

      // Collect all linked invoice IDs across all notes
      const allInvoiceIds = Array.from(
        new Set(
          notesData.flatMap((n: any) => {
            const ids = [...(n.invoice_ids || [])];
            if (n.invoice_id) ids.push(n.invoice_id);
            return ids;
          })
        )
      ).filter(Boolean) as string[];

      const invoicesMap = new Map<string, any>();
      if (allInvoiceIds.length > 0) {
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, invoice_number:bizonylatsorszam, supplier_name:elado_nev, net_amount:adoalap_osszesen, currency:penznem, invoice_date:kibocsatas_datuma')
          .in('id', allInvoiceIds);

        if (invoicesData) {
          invoicesData.forEach(inv => {
            invoicesMap.set(inv.id, inv);
          });
        }
      }

      return notesData.map((note: any) => {
        const linkedIds = [...(note.invoice_ids || [])];
        if (note.invoice_id && !linkedIds.includes(note.invoice_id)) {
          linkedIds.push(note.invoice_id);
        }
        
        const linkedInvoices = linkedIds.map((id: string) => invoicesMap.get(id)).filter(Boolean);

        return {
          ...note,
          invoices: linkedInvoices,
          profiles: {
            full_name: profileMap.get(note.user_id) || 'Ismeretlen felhasználó',
            email: null
          }
        };
      }) as Note[];
    },
    enabled: !!companyId,
  });

  const addNote = useMutation({
    mutationFn: async (params: {
      title: string;
      content: string;
      is_private: boolean;
      invoice_id: string | null;
      invoice_ids?: string[] | null;
    }) => {
      if (!companyId) throw new Error('Cég nincs kiválasztva');

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) throw new Error('Nem azonosított felhasználó');

      const { data, error } = await supabase
        .from('notes')
        .insert({
          company_id: companyId,
          user_id: userId,
          title: params.title,
          content: params.content,
          is_private: params.is_private,
          invoice_id: params.invoice_id,
          invoice_ids: params.invoice_ids || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', companyId] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async (params: {
      id: string;
      title: string;
      content: string;
      is_private: boolean;
      invoice_id: string | null;
      invoice_ids?: string[] | null;
    }) => {
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: params.title,
          content: params.content,
          is_private: params.is_private,
          invoice_id: params.invoice_id,
          invoice_ids: params.invoice_ids || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', companyId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', companyId] });
    },
  });

  return { notes, isLoading, refetch, addNote, updateNote, deleteNote };
}
