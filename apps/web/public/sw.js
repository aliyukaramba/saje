self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = typeof payload.title === "string" ? payload.title : "SAJE update";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new restaurant update.",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: payload.tag || "saje-notification",
    data: { url: typeof payload.url === "string" ? payload.url : "/admin/notifications" },
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin/notifications", self.location.origin);
  const safeUrl = target.origin === self.location.origin ? target.href : new URL("/admin/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(safeUrl);
        return;
      }
    }
    await self.clients.openWindow(safeUrl);
  })());
});
