-- Constraints Prisma's schema language cannot express. Applied after the init migration.

-- Non-negative and positive amounts / quantities
ALTER TABLE "Product" ADD CONSTRAINT product_baseprice_nonneg CHECK ("basePrice" >= 0);
ALTER TABLE "ModifierGroup" ADD CONSTRAINT modgroup_select_valid CHECK ("minSelect" >= 0 AND "maxSelect" >= "minSelect");
ALTER TABLE "Order" ADD CONSTRAINT order_total_nonneg CHECK ("total" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT orderitem_qty_pos CHECK ("quantity" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT payment_amount_pos CHECK ("amount" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT refund_amount_pos CHECK ("amount" > 0);
ALTER TABLE "CustomerReview" ADD CONSTRAINT review_rating_range CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "Reservation" ADD CONSTRAINT reservation_valid CHECK ("partySize" > 0 AND "endsAt" > "startsAt");

-- At most one active QR token per table
CREATE UNIQUE INDEX qrtoken_one_active_per_table ON "QrToken" ("tableId") WHERE "status" = 'ACTIVE';

-- At most one open (not closed) session per table
CREATE UNIQUE INDEX tablesession_one_open_per_table ON "TableSession" ("tableId") WHERE "status" <> 'CLOSED';

-- No overlapping active bookings on the same table
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation" ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist ("tableId" WITH =, tsrange("startsAt", "endsAt") WITH &&)
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'SEATED') AND "tableId" IS NOT NULL);
