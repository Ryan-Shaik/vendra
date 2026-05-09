-- Add check constraint to Cart
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_owner_check" CHECK (
  ("customerId" IS NOT NULL AND "guestSessionId" IS NULL AND "expiresAt" IS NULL) OR
  ("customerId" IS NULL AND "guestSessionId" IS NOT NULL AND "expiresAt" IS NOT NULL)
);