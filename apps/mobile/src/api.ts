// Talks to the website's API. Set EXPO_PUBLIC_API_URL to point the app at a different site (for example staging).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://saje-web.akarambaaleeyu.workers.dev";

export interface MenuCategory { id: string; name: string }

export interface OptionVariant { id: string; name: string; delta: string; isAvailable: boolean }
export interface OptionModifier { id: string; name: string; delta: string; isAvailable: boolean }
export interface OptionGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: OptionModifier[];
}
/** Money here is kobo as strings. */
export interface MenuOptions { unitMinor: string; variants: OptionVariant[]; groups: OptionGroup[] }

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  price: string;
  discountPrice: string | null;
  priceMinor: string;
  discountPriceMinor: string | null;
  isAvailable: boolean;
  hasOptions: boolean;
  options: MenuOptions | null;
}

export interface Menu {
  categories: MenuCategory[];
  items: MenuItem[];
  source: "database" | "unavailable";
}

/** Zone fees and minimums are naira decimal strings, as the website receives them. */
export interface DeliveryZone { id: string; name: string; fee: string; minOrderAmount: string }
export interface Fulfilment { pickupEnabled: boolean; deliveryEnabled: boolean; zones: DeliveryZone[] }

export interface CheckoutLine { productId: string; quantity: number; variantId?: string; modifierIds: string[] }

export interface DeliveryAddress { line1: string; city: string; state: string; landmark?: string; instructions?: string }

export type FulfilmentChoice =
  | { type: "PICKUP"; pickupAt: string }
  | { type: "DELIVERY"; zoneId: string; address: DeliveryAddress };

export interface CheckoutInput {
  lines: CheckoutLine[];
  customer: { name: string; phone: string; email: string };
  fulfilment: FulfilmentChoice;
}

export interface CheckoutResult { checkoutUrl: string; orderNumber: string; reference: string }

export interface OrderStatusResult { paymentStatus: string; orderNumber: string; orderStatus: string }

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error("Something went wrong. Please try again.");
  return (await res.json()) as T;
}

export const fetchMenu = () => getJson<Menu>("/api/menu");
export const fetchFulfilment = () => getJson<Fulfilment>("/api/fulfilment");

/** Starts an order and returns the payment page to open, plus the reference used to track it. */
export async function startCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const res = await fetch(`${API_URL}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<CheckoutResult> & { error?: string };
  if (!res.ok || !data.checkoutUrl || !data.orderNumber || !data.reference) {
    throw new Error(data.error ?? "We could not start your order. Please try again.");
  }
  return { checkoutUrl: data.checkoutUrl, orderNumber: data.orderNumber, reference: data.reference };
}

/** Public payment and order status for an order placed from this phone. */
export async function fetchOrderStatus(reference: string): Promise<OrderStatusResult> {
  return getJson<OrderStatusResult>(`/api/orders/status?ref=${encodeURIComponent(reference)}`);
}
