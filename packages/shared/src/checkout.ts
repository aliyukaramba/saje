import { CatalogError } from "./catalog/pricing";
import type { Minor } from "./money";

export type FulfilmentType = "PICKUP" | "DELIVERY";

export interface DeliveryZoneRule {
  id: string;
  fee: Minor;
  minOrderAmount: Minor;
  isActive: boolean;
}

export interface FulfilmentInput {
  type: FulfilmentType;
  subtotal: Minor;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  zone?: DeliveryZoneRule | null;
  pickupAt?: Date | null;
  now: Date;
  pickupLeadMinutes: number;
}

export interface FulfilmentResult {
  deliveryFee: Minor;
  zoneId: string | null;
  scheduledFor: Date | null;
}

/** Validates the fulfilment choice and returns the delivery fee and schedule. Throws CatalogError on violations. */
export function validateFulfilment(input: FulfilmentInput): FulfilmentResult {
  if (input.type === "PICKUP") {
    if (!input.pickupEnabled) throw new CatalogError("Pickup is not available right now");
    if (!input.pickupAt) throw new CatalogError("Choose a pickup time");
    const earliest = input.now.getTime() + input.pickupLeadMinutes * 60_000;
    if (input.pickupAt.getTime() < earliest) {
      throw new CatalogError(`Pickup must be at least ${input.pickupLeadMinutes} minutes from now`);
    }
    return { deliveryFee: 0n, zoneId: null, scheduledFor: input.pickupAt };
  }
  if (!input.deliveryEnabled) throw new CatalogError("Delivery is not available right now");
  if (!input.zone || !input.zone.isActive) throw new CatalogError("We do not deliver to this address");
  if (input.subtotal < input.zone.minOrderAmount) {
    throw new CatalogError("Order is below the minimum for this delivery zone");
  }
  return { deliveryFee: input.zone.fee, zoneId: input.zone.id, scheduledFor: null };
}
