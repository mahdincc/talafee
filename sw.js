/**
 * Talafee Service Worker — receives price-alert pushes and shows notifications.
 */

const API_BASE =
  self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/api/v1'
    : '/api/v1';

let namesCache = null;

async function loadNames() {
  if (namesCache) return namesCache;
  try {
    const response = await fetch('/config/providers.json');
    const config = await response.json();
    namesCache = {
      providers: config.providers || {},
      products: config.products || {},
    };
  } catch {
    namesCache = { providers: {}, products: {} };
  }
  return namesCache;
}

function formatRials(value) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

async function buildNotification(data) {
  const names = await loadNames();
  const providerName = names.providers[data.providerId]?.name?.fa || data.providerId;
  const productName = names.products[data.productId]?.name?.fa || data.productId;
  const fieldName = data.priceField === 'sell' ? 'قیمت فروش' : 'قیمت خرید';
  const boundText =
    data.bound === 'low'
      ? `به حد پایین (${formatRials(data.lowBound ?? data.price)}) رسید`
      : `به حد بالا (${formatRials(data.highBound ?? data.price)}) رسید`;

  return {
    title: `🔔 هشدار قیمت — ${productName}`,
    body: `${providerName}: ${fieldName} ${formatRials(data.price)} ریال — ${boundText}`,
  };
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  event.waitUntil(
    (async () => {
      const { title, body } = await buildNotification(data);

      await self.registration.showNotification(title, {
        body,
        dir: 'rtl',
        lang: 'fa',
        tag: `price-alert-${data.alertId}`,
        renotify: true,
        requireInteraction: true,
        icon: '/assets/images/providers/' + (data.providerId || 'taline') + '.svg',
        data,
        actions: [{ action: 'disable', title: 'خاموش کردن هشدار' }],
      });

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'price-alert', ...data });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};

  if (event.action === 'disable') {
    event.notification.close();
    event.waitUntil(
      (async () => {
        const subscription = await self.registration.pushManager.getSubscription();
        if (!subscription || !data.alertId) return;

        await fetch(`${API_BASE}/alerts/${data.alertId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint, enabled: false }),
        });
      })()
    );
    return;
  }

  event.notification.close();
  event.waitUntil(self.clients.openWindow('/user-panel.html'));
});
