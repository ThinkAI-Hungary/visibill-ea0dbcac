import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { STORAGE_KEYS, SIGNOUT_DELETE_KEYS } from '@/lib/constants';
import { useSessionGuard, type SessionGuardState } from '@/hooks/useSessionGuard';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  sessionGuard: SessionGuardState;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session error:', error.message);
        // If refresh token is invalid, clear local storage and reset state
        if (error.message.includes('Refresh Token') || error.message.includes('refresh_token')) {
          console.log('Invalid refresh token detected, clearing session...');
          localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          setSession(null);
          setUser(null);
        }
      } else {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Failed to get session:', err);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: name ? { name } : undefined
      }
    });
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Regisztráció sikertelen",
        description: error.message
      });
    } else {
      toast({
        title: "Ellenőrizd az email-ed",
        description: "Elküldtünk egy megerősítő linket."
      });

      // Send welcome email immediately (don't wait for email confirmation)
      // The edge function will check email preferences before sending
      supabase.functions.invoke('send-welcome-email', {
        body: {
          userId: data.user?.id,
          email: email,
          name: name || email.split('@')[0]
        }
      }).then(response => {
        if (response.error) {
          console.error('Failed to send welcome email:', response.error);
        } else {
          console.log('Welcome email sent successfully');
        }
      }).catch(err => {
        console.error('Error calling welcome email function:', err);
      });
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Bejelentkezés sikertelen",
        description: error.message
      });
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !`${error.message}`.toLowerCase().includes('session')) {
        // Ha nem "session missing" jellegű hiba, jelezzük
        throw error;
      }
    } catch (err: any) {
      // Nem kritikus – kliens oldalon kényszerített kijelentkezés
      console.warn('signOut fallback (forced):', err?.message || err);
    } finally {
      try {
        // Selective cleanup: only security-sensitive keys
        // UX preferences (theme, date_range, dashboard prefs) are preserved
        SIGNOUT_DELETE_KEYS.forEach(key => localStorage.removeItem(key));
      } catch {}
      setUser(null);
      setSession(null);
      toast({ title: 'Kijelentkezve', description: 'Sikeresen kijelentkeztél.' });
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: { message: "Nincs bejelentkezett felhasználó" } };
    }

    // Re-authenticate with current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      toast({
        variant: "destructive",
        title: "Hitelesítés sikertelen",
        description: "A jelenlegi jelszó helytelen"
      });
      return { error: signInError };
    }

    // Update to new password
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Jelszó módosítás sikertelen",
        description: error.message
      });
    } else {
      toast({
        title: "Sikeres",
        description: "Jelszó sikeresen megváltoztatva"
      });
    }

    return { error };
  };

  // ── Session guard: absolute expiry + idle warning + multi-tab sync ──
  const sessionGuard = useSessionGuard(signOut, !!user);

  const value = {
    user,
    session,
    loading,
    sessionGuard,
    signUp,
    signIn,
    signOut,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};