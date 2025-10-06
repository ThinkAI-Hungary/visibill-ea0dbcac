import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionContextType {
  subscribed: boolean;
  tier: 'salmon' | 'tuna' | 'shark' | 'orca' | 'teszt';
  productId: string | null;
  subscriptionEnd: string | null;
  invoiceLimit: number;
  invoicesUsed: number;
  remainingInvoices: number;
  periodEnd: string | null;
  loading: boolean;
  checkSubscription: () => Promise<void>;
  createCheckout: (priceId: string) => Promise<string>;
  openCustomerPortal: () => Promise<string>;
  canProcessInvoice: () => boolean;
  incrementUsage: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [tier, setTier] = useState<'salmon' | 'tuna' | 'shark' | 'orca' | 'teszt'>('salmon');
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [invoiceLimit, setInvoiceLimit] = useState(3);
  const [invoicesUsed, setInvoicesUsed] = useState(0);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkSubscription = async () => {
    if (!session?.access_token) {
      // Reset to free tier if no session
      setSubscribed(false);
      setTier('salmon');
      setProductId(null);
      setSubscriptionEnd(null);
      setInvoiceLimit(3);
      setInvoicesUsed(0);
      setPeriodEnd(null);
      return;
    }

    setLoading(true);
    try {
      // First get Stripe subscription info
      const { data: stripeData, error: stripeError } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (stripeError) throw stripeError;

      // Then get local usage data
      const { data: usageData, error: usageError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (usageError && usageError.code !== 'PGRST116') {
        console.error('Error fetching usage data:', usageError);
      }

      // Update states with both Stripe and local data
      setSubscribed(stripeData.subscribed || false);
      setTier(stripeData.tier || 'salmon');
      setProductId(stripeData.product_id);
      setSubscriptionEnd(stripeData.subscription_end);
      
      // Set usage data from local database or defaults
      if (usageData) {
        setInvoiceLimit(usageData.invoice_limit);
        setInvoicesUsed(usageData.invoices_used);
        setPeriodEnd(usageData.period_end);
      } else {
        // Initialize with defaults if no usage data exists
        setInvoiceLimit(3);
        setInvoicesUsed(0);
        setPeriodEnd(null);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      // Reset to free tier on error
      setSubscribed(false);
      setTier('salmon');
      setProductId(null);
      setSubscriptionEnd(null);
      setInvoiceLimit(3);
      setInvoicesUsed(0);
      setPeriodEnd(null);
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async (priceId: string): Promise<string> => {
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { priceId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;
    return data.url;
  };

  const openCustomerPortal = async (): Promise<string> => {
    if (!session?.access_token) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase.functions.invoke('customer-portal', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;
    return data.url;
  };

  const canProcessInvoice = (): boolean => {
    return invoicesUsed < invoiceLimit;
  };

  const incrementUsage = async (): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (!canProcessInvoice()) {
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('increment_invoice_usage', {
        user_uuid: user.id
      });

      if (error) throw error;

      if (data) {
        // Update local state
        setInvoicesUsed(prev => prev + 1);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      return false;
    }
  };

  // Check subscription when user or session changes
  useEffect(() => {
    if (user) {
      checkSubscription();
      
      // Set up periodic refresh (every 60 seconds)
      const interval = setInterval(checkSubscription, 60000);
      return () => clearInterval(interval);
    } else {
      // Reset subscription state when user logs out
      setSubscribed(false);
      setTier('salmon');
      setProductId(null);
      setSubscriptionEnd(null);
      setInvoiceLimit(3);
      setInvoicesUsed(0);
      setPeriodEnd(null);
    }
  }, [user, session]);

  const remainingInvoices = Math.max(0, invoiceLimit - invoicesUsed);

  const value = {
    subscribed,
    tier,
    productId,
    subscriptionEnd,
    invoiceLimit,
    invoicesUsed,
    remainingInvoices,
    periodEnd,
    loading,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    canProcessInvoice,
    incrementUsage,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};