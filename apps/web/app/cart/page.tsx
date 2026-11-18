import { CartView } from "../../components/CartView";

export const dynamic = "force-dynamic";

export default function CartPage() {
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/menu">{process.env.RESTAURANT_NAME ?? "Restaurant"}<span>.</span></a>
      </header>
      <h1 className="page-title"><strong>Your</strong> cart</h1>
      <CartView />
    </div>
  );
}
