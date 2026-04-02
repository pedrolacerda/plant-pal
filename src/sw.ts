/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "🌿 Meu Jardim";
  const options: NotificationOptions = {
    body: data.body ?? "Você tem plantas para cuidar hoje!",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "daily-care-reminder",
    data: { url: "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url: string = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) return client.focus();
        }
        return clients.openWindow(url);
      })
  );
});
