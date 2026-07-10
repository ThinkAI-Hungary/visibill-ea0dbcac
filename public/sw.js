self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Új értesítés';
      const options = {
        body: data.body || '',
        icon: data.icon || '/eaisybill_favicon.svg',
        badge: data.badge || '/eaisybill_favicon.svg',
        data: {
          url: data.url || '/'
        }
      };

      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.error('Hiba a push payload feldolgozásakor:', e);
      // Fallback
      event.waitUntil(
        self.registration.showNotification('Új értesítés', {
          body: event.data.text(),
          icon: '/eaisybill_favicon.svg'
        })
      );
    }
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Ha van nyitott tab, fókuszálunk rá és odanavigálunk
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(event.notification.data.url);
            return client.focus();
          }
        }
        // Ha nincs nyitott tab, nyitunk egy újat
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});
