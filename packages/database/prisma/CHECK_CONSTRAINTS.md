# Check constraints (add in the first migration)

Prisma's schema language does not support CHECK constraints, so they are added with raw SQL in
a migration after `prisma migrate dev --create-only`:

- Product.basePrice >= 0
- ModifierGroup: minSelect >= 0 AND maxSelect >= minSelect
- Order.total >= 0
- OrderItem.quantity > 0
- Payment.amount > 0
- Refund.amount > 0
- Reservation: partySize > 0 AND endsAt > startsAt
- CustomerReview.rating BETWEEN 1 AND 5

Also required in SQL (not expressible in Prisma):
- Partial unique index on QrToken(tableId) WHERE status = 'ACTIVE'
- Partial unique index on TableSession(tableId) WHERE status <> 'CLOSED'
- Exclusion constraint on Reservation(tableId, tstzrange(startsAt, endsAt)) for active statuses
