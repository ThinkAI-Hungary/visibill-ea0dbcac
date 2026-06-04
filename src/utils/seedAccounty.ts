/**
 * Accounty seed helper – Calls the accounty-seed edge function
 * which runs with service_role (bypasses RLS) to create assignments.
 */
import { supabase } from '@/integrations/supabase/client';

export async function seedAccountyAssignments() {
  try {
    // Get current session for the auth token
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !session) {
      console.error('[seed] Not logged in:', sessErr);
      return { error: 'Not logged in' };
    }

    console.log('[seed] Calling accounty-seed edge function...');

    const { data, error } = await supabase.functions.invoke('accounty-seed', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('[seed] Edge function error:', error);
      return { error: error.message };
    }

    console.log('[seed] Result:', data);
    return data;
  } catch (err) {
    console.error('[seed] Unexpected error:', err);
    return { error: String(err) };
  }
}
