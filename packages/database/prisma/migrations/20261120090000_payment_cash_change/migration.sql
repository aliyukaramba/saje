-- Cash received and change returned, for counter cash sales.
ALTER TABLE "Payment" ADD COLUMN "cashTendered" DECIMAL(12,2),
ADD COLUMN "changeGiven" DECIMAL(12,2);
