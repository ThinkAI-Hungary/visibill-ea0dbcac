/**
 * Accounty seed helper – Calls the accounty-seed edge function
 * which runs with service_role (bypasses RLS) to create assignments.
 */
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';

export async function seedAccountyAssignments() {
  try {
    // Get current session for the auth token
    const { data: { session }, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !session) {
      reportError({ type: 'db_query', component: 'seedAccounty', action: 'error', message: '[seed] Not logged in:', error: sessErr });
      return { error: 'Not logged in' };
    }

    console.log('[seed] Calling accounty-seed edge function...');

    const { data, error } = await supabase.functions.invoke('accounty-seed', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      reportError({ type: 'db_query', component: 'seedAccounty', action: 'error', message: '[seed] Edge function error:', error: error });
      return { error: error.message };
    }

    console.log('[seed] Result:', data);
    return data;
  } catch (err) {
    reportError({ type: 'db_query', component: 'seedAccounty', action: 'error', message: '[seed] Unexpected error:', error: err });
    return { error: String(err) };
  }
}
