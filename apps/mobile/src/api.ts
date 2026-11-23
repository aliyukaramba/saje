// Talks to the website's API. Set EXPO_PUBLIC_API_URL to point the app at a different site (for example staging).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://saje-web.akarambaaleeyu.workers.dev";

export interface MenuCategory { id: string; name: string }

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  price: string;
  discountPrice: string | null;
  isAvailable: boolean;
  hasOptions: boolean;
}

export interface Menu {
  categories: MenuCategory[];
  items: MenuItem[];
  source: "database" | "unavailable";
}

export async function fetchMenu(): Promise<Menu> {
  const res = await fetch(`${API_URL}/api/menu`);
  if (!res.ok) throw new Error("The menu could not be loaded.");
  return (await res.json()) as Menu;
}

export interface CheckoutInput {
  lines: { productId: string; quantity: number }[];
  customer: { name: string; phone: string; email: string };
  pickupAt: Date;
}

/** Starts an order for pickup and returns the payment page to open. */
export async function startPickupCheckout(input: CheckoutInput): Promise<{ checkoutUrl: string; orderNumber: string }> {
  const res = await fetch(`${API_URL}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      lines: input.lines.map((l) => ({ ...l, modifierIds: [] })),
      customer: input.customer,
      fulfilment: { type: "PICKUP", pickupAt: input.pickupAt.toISOString() },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; orderNumber?: string; error?: string };
  if (!res.ok || !data.checkoutUrl || !data.orderNumber) {
    throw new Error(data.error ?? "We could not start your order. Please try again.");
  }
  return { checkoutUrl: data.checkoutUrl, orderNumber: data.orderNumber };
}
