import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { STORAGE_KEYS, SIGNOUT_DELETE_KEYS } from '@/lib/constants';
import { useSessionGuard, type SessionGuardState } from '@/hooks/useSessionGuard';

const ABSOLUTE_LIMIT_MS = 4 * 60 * 60 * 1000; // 4 hours

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSigningOut: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
        if (gateCheckedRef.current && expiredRef.current && event !== 'SIGNED_IN' && event !== 'PASSWORD_RECOVERY') {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
        // A fresh SIGNED_IN or PASSWORD_RECOVERY resets the expired flag so subsequent events work
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          expiredRef.current = false;
        }
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
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
      // No toast — Auth.tsx shows a dedicated confirmation screen
      // Welcome email is sent automatically by the handle_new_user trigger via pg_net
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
    // Show the signing-out overlay immediately
    setIsSigningOut(true);

    // Small delay so the overlay paints before we start clearing
    await new Promise((r) => setTimeout(r, 100));

    try {
      const { error } = await supabase.auth.signOut();
      if (error && !`${error.message}`.toLowerCase().includes('session')) {
        throw error;
      }
    } catch (err: any) {
      console.warn('signOut fallback (forced):', err?.message || err);
    } finally {
      // ── Atomic Cleanup ──

      // 1. Remove all security-sensitive keys
      try {
        SIGNOUT_DELETE_KEYS.forEach(key => localStorage.removeItem(key));
      } catch {}

      // 2. Remove LAST_ACTIVE
      try {
        localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
      } catch {}

      // 3. Remove all visibill_ prefixed keys EXCEPT theme (UX preference)
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('visibill_') && key !== STORAGE_KEYS.THEME) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch {}

      // 4. Clear ALL TanStack Query cached data
      queryClient.clear();

      // 5. Clear React state
      setUser(null);
      setSession(null);

      // Only flag the toast for explicit user-initiated sign-outs.
      // The Auth page will pick this up on mount and display it AFTER
      // the redirect completes — so the user never sees the toast
      // flash on top of the still-mounted protected layout.
      if (!options?.silent) {
        try {
          sessionStorage.setItem('visibill_pending_signout_toast', '1');
        } catch {}
      }

      // Always flag the post-signout redirect so ProtectedLayout drops the
      // scoped returnTo path and sends the user to the bare /auth page.
      // On next login they'll land on the root (dashboard) instead of being
      // taken back to whatever URL they were on before signing out.
      try {
        sessionStorage.setItem('visibill_post_signout_redirect', '1');
      } catch {}

      // Brief delay so the overlay stays visible during transition
      await new Promise((r) => setTimeout(r, 300));
      setIsSigningOut(false);
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

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  const value = {
    user,
    session,
    loading,
    isSigningOut,
    isPasswordRecovery,
    clearPasswordRecovery,
    sessionGuard,
    signUp,
    signIn,
    signOut,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};