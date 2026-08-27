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
          transaction_id,
          transaction_ids,
          created_at,
          updated_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (notesError) throw notesError;

      let dbNotesMapped: any[] = [];
      if (notesData && notesData.length > 0) {
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

        // Collect all linked transaction IDs across all notes
        const allTransactionIds = Array.from(
          new Set(
            notesData.flatMap((n: any) => {
              const ids = [...(n.transaction_ids || [])];
              if (n.transaction_id) ids.push(n.transaction_id);
              return ids;
            })
          )
        ).filter(Boolean) as string[];

        const transactionsMap = new Map<string, any>();
        if (allTransactionIds.length > 0) {
          const { data: transactionsData } = await supabase
            .from('transactions')
            .select('id, transaction_date, description, amount, currency')
            .in('id', allTransactionIds);

          if (transactionsData) {
            transactionsData.forEach(tx => {
              transactionsMap.set(tx.id, {
                id: tx.id,
                transaction_date: tx.transaction_date,
                description: tx.description || '',
                amount: tx.amount,
                currency: tx.currency || 'HUF',
                bank_name: ''
              });
            });
          }
        }

        dbNotesMapped = notesData.map((note: any) => {
          const linkedInvIds = [...(note.invoice_ids || [])];
          if (note.invoice_id && !linkedInvIds.includes(note.invoice_id)) {
            linkedInvIds.push(note.invoice_id);
          }
          const linkedInvoices = linkedInvIds.map((id: string) => invoicesMap.get(id)).filter(Boolean);

          const linkedTxIds = [...(note.transaction_ids || [])];
          if (note.transaction_id && !linkedTxIds.includes(note.transaction_id)) {
            linkedTxIds.push(note.transaction_id);
          }
          const linkedTransactions = linkedTxIds.map((id: string) => transactionsMap.get(id)).filter(Boolean);

          return {
            ...note,
            invoices: linkedInvoices,
            transactions: linkedTransactions,
            profiles: {
              full_name: profileMap.get(note.user_id) || 'Ismeretlen felhasználó',
              email: null
            }
          };
        });
      }

      // Fetch nav_invoice_items notes
      const { data: navItemNotes } = await supabase
        .from('nav_invoice_items')
        .select(`
          id,
          notes,
          created_at,
          nav_invoices!inner(
            id,
            invoice_number,
            supplier_name,
            customer_name,
            invoice_gross_amount,
            invoice_direction,
            currency,
            invoice_issue_date
          )
        `)
        .eq('nav_invoices.company_id', companyId)
        .not('notes', 'is', null);

      // Fetch invoice_items notes
      const { data: itemNotes } = await supabase
        .from('invoice_items')
        .select(`
          id,
          notes,
          created_at,
          invoices!inner(
            id,
            bizonylatsorszam,
            elado_nev,
            brutto_vegosszeg,
            invoice_direction,
            penznem,
            kibocsatas_datuma
          )
        `)
        .eq('invoices.company_id', companyId)
        .not('notes', 'is', null);

      const mappedNavItems = (navItemNotes || []).map((item: any) => {
        const inv = item.nav_invoices;
        return {
          id: item.id,
          company_id: companyId,
          user_id: null,
          title: `Számlatétel jegyzet - ${inv?.invoice_number || 'Nincs sorszám'}`,
          content: item.notes,
          is_private: false,
          invoice_id: inv?.id || null,
          invoice_ids: inv ? [inv.id] : [],
          transaction_id: null,
          transaction_ids: [],
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.created_at || new Date().toISOString(),
          is_line_item_note: true,
          profiles: {
            full_name: 'Számlatétel jegyzet',
            email: null
          },
          invoices: inv ? [{
            id: inv.id,
            invoice_number: inv.invoice_number,
            supplier_name: inv.supplier_name,
            net_amount: parseFloat(inv.invoice_gross_amount) || 0,
            currency: inv.currency || 'HUF',
            invoice_date: inv.invoice_issue_date
          }] : [],
          transactions: []
        };
      });

      const mappedSubmittedItems = (itemNotes || []).map((item: any) => {
        const inv = item.invoices;
        return {
          id: item.id,
          company_id: companyId,
          user_id: null,
          title: `Számlatétel jegyzet - ${inv?.bizonylatsorszam || 'Nincs sorszám'}`,
          content: item.notes,
          is_private: false,
          invoice_id: inv?.id || null,
          invoice_ids: inv ? [inv.id] : [],
          transaction_id: null,
          transaction_ids: [],
          created_at: item.created_at || new Date().toISOString(),
          updated_at: item.created_at || new Date().toISOString(),
          is_line_item_note: true,
          profiles: {
            full_name: 'Számlatétel jegyzet',
            email: null
          },
          invoices: inv ? [{
            id: inv.id,
            invoice_number: inv.bizonylatsorszam,
            supplier_name: inv.elado_nev,
            net_amount: parseFloat(inv.brutto_vegosszeg) || 0,
            currency: inv.penznem || 'HUF',
            invoice_date: inv.kibocsatas_datuma
          }] : [],
          transactions: []
        };
      });

      const combined = [
        ...dbNotesMapped,
        ...mappedNavItems,
        ...mappedSubmittedItems
      ];

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined as Note[];
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
      transaction_id?: string | null;
      transaction_ids?: string[] | null;
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
          transaction_id: params.transaction_id || null,
          transaction_ids: params.transaction_ids || [],
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
      transaction_id?: string | null;
      transaction_ids?: string[] | null;
    }) => {
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: params.title,
          content: params.content,
          is_private: params.is_private,
          invoice_id: params.invoice_id,
          invoice_ids: params.invoice_ids || [],
          transaction_id: params.transaction_id || null,
          transaction_ids: params.transaction_ids || [],
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
