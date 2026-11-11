// Cesta — service worker mínimo para web push notifications.
// Notificações chegam como JSON com { title, body, icon, tag, data }.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Cesta", body: event.data.text() };
  }
  const { title = "Cesta", body = "", icon, tag, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/favicon.ico",
      tag,
      data,
      badge: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.productId ? `/produto/${data.productId}` : "/alertas";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
