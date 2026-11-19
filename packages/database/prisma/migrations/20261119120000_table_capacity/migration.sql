-- Seats per table, used to assign reservations. Existing tables default to 4 seats.
ALTER TABLE "DiningTable" ADD COLUMN "capacity" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "DiningTable" ADD CONSTRAINT "diningtable_capacity_positive" CHECK ("capacity" BETWEEN 1 AND 30);
