ALTER TABLE "Notification" ADD COLUMN "guestReference" TEXT;
CREATE INDEX "Notification_guestReference_createdAt_idx" ON "Notification"("guestReference", "createdAt");

CREATE TABLE "GuestPushDeviceToken" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" "PushPlatform" NOT NULL,
  "appVersion" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestPushDeviceToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestPushDeviceToken_token_key" ON "GuestPushDeviceToken"("token");
CREATE UNIQUE INDEX "GuestPushDeviceToken_orderId_installationId_key" ON "GuestPushDeviceToken"("orderId", "installationId");
CREATE INDEX "GuestPushDeviceToken_orderId_disabledAt_idx" ON "GuestPushDeviceToken"("orderId", "disabledAt");
ALTER TABLE "GuestPushDeviceToken" ADD CONSTRAINT "GuestPushDeviceToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
