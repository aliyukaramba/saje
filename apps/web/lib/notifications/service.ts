import { prisma } from "@restaurant/database";
import { sendBrowserPush } from "./web-push";

type OrderStatus = "PENDING" | "CONFIRMED" | "ACCEPTED" | "PREPARING" | "READY" | "OUT_FOR_DELIVERY" | "COMPLETED" | "CANCELLED";

const statusCopy: Record<OrderStatus, { title: string; body: string; priority: "NORMAL" | "HIGH" }> = {
  PENDING: { title: "Order received", body: "We have received your order.", priority: "NORMAL" },
  CONFIRMED: { title: "Order confirmed", body: "Your order has been confirmed by the restaurant.", priority: "NORMAL" },
  ACCEPTED: { title: "Kitchen accepted your order", body: "The kitchen has started handling your order.", priority: "NORMAL" },
  PREPARING: { title: "Your order is being prepared", body: "Our kitchen is preparing your order.", priority: "NORMAL" },
  READY: { title: "Your order is ready", body: "Your order is ready. Please follow the collection or service instructions.", priority: "HIGH" },
  OUT_FOR_DELIVERY: { title: "Order on the way", body: "Your order has been dispatched for delivery.", priority: "HIGH" },
  COMPLETED: { title: "Order completed", body: "Your order has been completed. Thank you for choosing SAJE.", priority: "NORMAL" },
  CANCELLED: { title: "Order cancelled", body: "Your order has been cancelled. Contact the restaurant if you need help.", priority: "HIGH" },
};

async function sendPushNotifications(notificationId: string, orderId: string, userId: string | null, title: string, body: string, data: Record<string, string>) {
  const [accountDevices, guestDevices, browserSubscriptions, preference] = await Promise.all([
    userId ? prisma.pushDeviceToken.findMany({ where: { userId, disabledAt: null, platform: { in: ["IOS", "ANDROID"] } }, select: { id: true, token: true } }) : Promise.resolve([]),
    prisma.guestPushDeviceToken.findMany({ where: { orderId, disabledAt: null, platform: { in: ["IOS", "ANDROID"] } }, select: { id: true, token: true } }),
    userId ? prisma.webPushSubscription.findMany({ where: { userId, disabledAt: null }, select: { id: true, endpoint: true, p256dh: true, auth: true } }) : Promise.resolve([]),
    userId ? prisma.notificationPreference.findUnique({ where: { userId_category: { userId, category: "ORDERS" } }, select: { push: true } }) : Promise.resolve(null),
  ]);
  if (preference?.push === false) return;

  const devices = [
    ...accountDevices.map(device => ({ ...device, kind: "ACCOUNT" as const })),
    ...guestDevices.map(device => ({ ...device, kind: "GUEST" as const })),
  ];
  let retryableFailure = false;

  for (const device of devices) {
    const key = { notificationId_channel_target: { notificationId, channel: "PUSH" as const, target: device.id } };
    const existing = await prisma.notificationDelivery.findUnique({ where: key, select: { id: true, status: true } });
    if (existing?.status === "SENT" || existing?.status === "DELIVERED") continue;
    const delivery = await prisma.notificationDelivery.upsert({
      where: key,
      create: { notificationId, channel: "PUSH", target: device.id, status: "PROCESSING", attempts: 1 },
      update: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
    });
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ to: device.token, title, body, sound: "default", priority: "high", channelId: "orders", data }),
      });
      const result = await response.json() as { data?: { status?: string; id?: string; message?: string; details?: { error?: string } } };
      const ticket = result.data;
      if (!response.ok || !ticket || ticket.status !== "ok") {
        const reason = ticket?.message ?? "Expo push provider rejected the message.";
        await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", lastError: reason } });
        if (ticket?.details?.error === "DeviceNotRegistered") {
          if (device.kind === "ACCOUNT") await prisma.pushDeviceToken.update({ where: { id: device.id }, data: { disabledAt: new Date() } });
          else await prisma.guestPushDeviceToken.update({ where: { id: device.id }, data: { disabledAt: new Date() } });
        } else {
          retryableFailure = true;
        }
        continue;
      }
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", providerId: ticket.id ?? null, sentAt: new Date(), lastError: null },
      });
    } catch (error) {
      retryableFailure = true;
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 500) : "Push delivery failed." },
      });
    }
  }

  for (const subscription of browserSubscriptions) {
    const key = { notificationId_channel_target: { notificationId, channel: "PUSH" as const, target: subscription.id } };
    const existing = await prisma.notificationDelivery.findUnique({ where: key, select: { id: true, status: true } });
    if (existing?.status === "SENT" || existing?.status === "DELIVERED") continue;
    const delivery = await prisma.notificationDelivery.upsert({
      where: key,
      create: { notificationId, channel: "PUSH", target: subscription.id, status: "PROCESSING", attempts: 1 },
      update: { status: "PROCESSING", attempts: { increment: 1 }, lastError: null },
    });
    try {
      const result = await sendBrowserPush(subscription, {
        title,
        body,
        url: "/admin/notifications",
      });
      if (!result.ok) {
        const reason = `Browser push endpoint returned HTTP ${result.status}.`;
        await prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", lastError: reason } });
        if (result.status === 404 || result.status === 410) {
          await prisma.webPushSubscription.update({ where: { id: subscription.id }, data: { disabledAt: new Date() } });
        } else {
          retryableFailure = true;
        }
        continue;
      }
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", providerId: result.providerId, sentAt: new Date(), lastError: null },
      });
    } catch (error) {
      retryableFailure = true;
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 500) : "Browser push delivery failed." },
      });
    }
  }

  if (retryableFailure) throw new Error("One or more push notifications failed and will be retried from the outbox.");
}

export async function notifyOrderStatusChange(orderId: string, fromStatus: string, toStatus: string) {
  if (!(toStatus in statusCopy)) return;
  const status = toStatus as OrderStatus;
  const copy = statusCopy[status];
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true, customerId: true, assignedStaffId: true, type: true, tableSessionId: true, payments: { select: { reference: true } } },
  });
  if (!order) return;

  const recipients = new Map<string, string>();
  const customerStatuses: OrderStatus[] = ["CONFIRMED", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED"];
  if (order.customerId && customerStatuses.includes(status)) recipients.set(order.customerId, "CUSTOMER");

  const roleKeys = status === "CONFIRMED" || status === "CANCELLED"
    ? ["kitchen_staff", "restaurant_manager"]
    : status === "READY" ? ["waiter", "restaurant_manager"]
    : status === "OUT_FOR_DELIVERY" ? ["delivery_staff", "restaurant_manager"]
    : [];
  if (roleKeys.length) {
    const staff = await prisma.user.findMany({
      where: { kind: "STAFF", status: "ACTIVE", deletedAt: null, roles: { some: { role: { key: { in: roleKeys } } } } },
      select: { id: true },
    });
    for (const person of staff) recipients.set(person.id, "STAFF");
  }
  if (order.assignedStaffId && ["READY", "CANCELLED", "OUT_FOR_DELIVERY"].includes(status)) recipients.set(order.assignedStaffId, "STAFF");

  const eventKey = `order:${order.id}:status:${fromStatus}:${status}`;
  const outbox = await prisma.notificationOutboxEvent.upsert({
    where: { idempotencyKey: eventKey },
    create: {
      eventType: "ORDER_STATUS_CHANGED",
      aggregateType: "Order",
      aggregateId: order.id,
      idempotencyKey: eventKey,
      payload: { orderId: order.id, orderNumber: order.orderNumber, fromStatus, toStatus: status },
    },
    update: {},
  });

  for (const [userId] of recipients) {
    const preference = await prisma.notificationPreference.findUnique({
      where: { userId_category: { userId, category: "ORDERS" } },
      select: { inApp: true, push: true },
    });
    const inAppEnabled = preference?.inApp !== false;
    const pushEnabled = preference?.push !== false;
    if (!inAppEnabled && !pushEnabled) continue;
    const dedupeKey = `${eventKey}:user:${userId}`;
    const notification = await prisma.notification.upsert({
      where: { dedupeKey },
      create: {
        userId,
        channel: inAppEnabled ? "IN_APP" : "PUSH",
        type: "ORDER_STATUS",
        category: "ORDERS",
        title: copy.title,
        body: `${copy.body} Order #${order.orderNumber}.`,
        priority: copy.priority,
        dedupeKey,
        relatedEntityType: "Order",
        relatedEntityId: order.id,
        payload: { orderId: order.id, orderNumber: order.orderNumber, status, route: "/orders" },
      },
      update: {},
      select: { id: true },
    });
    if (pushEnabled) {
      await sendPushNotifications(notification.id, order.id, userId, copy.title, `${copy.body} Order #${order.orderNumber}.`, {
        notificationId: notification.id, type: "ORDER_STATUS", orderId: order.id, route: "/orders",
      });
    }
  }

  if (!order.customerId && customerStatuses.includes(status)) {
    const guestReference = order.payments[0]?.reference ?? null;
    const dedupeKey = `${eventKey}:guest`;
    const notification = await prisma.notification.upsert({
      where: { dedupeKey },
      create: {
        userId: null, guestReference, channel: "IN_APP", type: "ORDER_STATUS", category: "ORDERS",
        title: copy.title, body: `${copy.body} Order #${order.orderNumber}.`, priority: copy.priority,
        dedupeKey, relatedEntityType: "Order", relatedEntityId: order.id,
        payload: { orderId: order.id, orderNumber: order.orderNumber, status, route: "/notifications" },
      },
      update: {},
      select: { id: true },
    });
    await sendPushNotifications(notification.id, order.id, null, copy.title, `${copy.body} Order #${order.orderNumber}.`, {
      notificationId: notification.id, type: "ORDER_STATUS", orderId: order.id, route: "/notifications",
    });
  }
  await prisma.notificationOutboxEvent.update({
    where: { id: outbox.id },
    data: { status: "PROCESSED", processedAt: new Date(), attempts: { increment: 1 }, lastError: null },
  });
}
