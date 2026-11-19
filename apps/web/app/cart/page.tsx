import { SiteNav } from "../../components/SiteNav";
import { prisma, loadFulfilmentOptions } from "@restaurant/database";
import { CartView } from "../../components/CartView";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const options = await loadFulfilmentOptions(prisma);
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/menu">{process.env.RESTAURANT_NAME ?? "Restaurant"}<span>.</span></a>
        <SiteNav />
      </header>
      <h1 className="page-title"><strong>Your</strong> cart</h1>
      <CartView options={options} />
    </div>
  );
}
