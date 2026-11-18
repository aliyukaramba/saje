import { loadMenu } from "../../lib/catalog-source";
import { MenuBrowser } from "../../components/MenuBrowser";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const menu = await loadMenu();
  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="/">{process.env.RESTAURANT_NAME ?? "Restaurant"}<span>.</span></a>
        <a className="cart-link" href="/cart">Cart</a>
      </header>
      <h1 className="page-title"><strong>Our</strong> menu</h1>
      <MenuBrowser menu={menu} />
    </div>
  );
}
