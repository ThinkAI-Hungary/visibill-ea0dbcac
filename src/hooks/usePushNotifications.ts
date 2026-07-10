import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !publicVapidKey) return;

    const restoreSubscription = async () => {
      try {
        // 1. Check if user actually enabled push in preferences
        const { data: prefs } = await supabase
          .from('accounty_push_preferences' as any)
          .select('enabled')
          .eq('user_id', userId)
          .maybeSingle();

        if (prefs && prefs.enabled) {
          // 2. Check if browser has granted permission
          if (Notification.permission === 'granted') {
            if ('serviceWorker' in navigator && 'PushManager' in window) {
              const registration = await navigator.serviceWorker.ready;
              
              // Get current subscription
              let subscription = await registration.pushManager.getSubscription();
              
              // If missing, subscribe implicitly
              if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                });
              }
              
              // 3. Save subscription to DB
              if (subscription) {
                const subJson = subscription.toJSON();
                if (subJson.endpoint && subJson.keys?.auth && subJson.keys?.p256dh) {
                  await supabase
                    .from('accounty_push_subscriptions' as any)
                    .upsert({
                      user_id: userId,
                      endpoint: subJson.endpoint,
                      auth_key: subJson.keys.auth,
                      p256dh_key: subJson.keys.p256dh,
                    }, { onConflict: 'endpoint' });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[usePushNotifications] Auto-restore failed:', err);
      }
    };

    restoreSubscription();
  }, [userId]);
}

export const unsubscribeFromPush = async (userId: string | undefined) => {
  if (!userId) return;
  try {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Töröljük a backendről
        await supabase
          .from('accounty_push_subscriptions' as any)
          .delete()
          .eq('endpoint', subscription.endpoint)
          .eq('user_id', userId);
          
        // Leiratkozunk a böngészőben is
        await subscription.unsubscribe();
      }
    }
  } catch (err) {
    console.error('[usePushNotifications] Unsubscribe failed:', err);
  }
};
