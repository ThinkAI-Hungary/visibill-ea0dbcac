import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { STORAGE_KEYS, SIGNOUT_DELETE_KEYS } from '@/lib/constants';
import { useSessionGuard, type SessionGuardState } from '@/hooks/useSessionGuard';

const ABSOLUTE_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  sessionGuard: SessionGuardState;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: (options?: { silent?: boolean }) => Promise<void>;
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

/** Check if lastActive timestamp is older than 4 hours (synchronous) */
function isSessionExpired(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
    if (!stored) return false; // first visit — no gate
    const elapsed = Date.now() - parseInt(stored, 10);
    return elapsed >= ABSOLUTE_LIMIT_MS;
  } catch {
    return false;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const gateCheckedRef = useRef(false);
  const expiredRef = useRef(false);

  useEffect(() => {
    // ── PRE-FLIGHT: Absolute 4h gate ──
    // Runs BEFORE session restore.  If expired, kill session immediately.
    const expired = isSessionExpired();
    expiredRef.current = expired;

    // Mark gate as checked BEFORE registering the listener to prevent
    // any synchronous INITIAL_SESSION event from bypassing the gate.
    gateCheckedRef.current = true;

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // If gate already killed the session, ignore incoming auth events
        // that try to restore it (except fresh SIGNED_IN from login form)
        if (gateCheckedRef.current && expiredRef.current && event !== 'SIGNED_IN') {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        // A fresh SIGNED_IN resets the expired flag so subsequent events work
        if (event === 'SIGNED_IN') {
          expiredRef.current = false;
        }
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    );

    if (expired) {
      // Session is stale — force sign out silently, don't restore anything
      supabase.auth.signOut().catch(() => {});
      try {
        SIGNOUT_DELETE_KEYS.forEach(key => localStorage.removeItem(key));
        localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
      } catch {}
      setSession(null);
      setUser(null);
      setLoading(false);
    } else {
      // Normal path — check for existing session
      supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
        if (error) {
          console.error('Session error:', error.message);
          if (error.message.includes('Refresh Token') || error.message.includes('refresh_token')) {
            console.log('Invalid refresh token detected, clearing session...');
            localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
            setSession(null);
            setUser(null);
          }
        } else {
          setSession(existingSession);
          setUser(existingSession?.user ?? null);
        }
        setLoading(false);
      }).catch((err) => {
        console.error('Failed to get session:', err);
        setLoading(false);
      });
    }

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
    } else {
      // ── Login success: reset lastActive so gate won't block ──
      try {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString());
      } catch {}
    }
    
    return { error };
  };

  const signOut = async (options?: { silent?: boolean }) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error && !`${error.message}`.toLowerCase().includes('session')) {
        throw error;
      }
    } catch (err: any) {
      console.warn('signOut fallback (forced):', err?.message || err);
    } finally {
      try {
        SIGNOUT_DELETE_KEYS.forEach(key => localStorage.removeItem(key));
      } catch {}
      setUser(null);
      setSession(null);
      // Only show toast for explicit user-initiated sign-outs, not gate/timeout
      if (!options?.silent) {
        toast({ title: 'Kijelentkezve', description: 'Sikeresen kijelentkeztél.' });
      }
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: { message: "Nincs bejelentkezett felhasználó" } };
    }

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

  // ── Session guard: idle warning + multi-tab sync (absolute gate handled above) ──
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