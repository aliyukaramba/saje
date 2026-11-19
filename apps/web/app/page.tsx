import Link from "next/link";
import { prisma, loadMenuFromDb } from "@restaurant/database";
import { AddToCart } from "../components/AddToCart";
import { SiteNav } from "../components/SiteNav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const restaurantName = process.env.RESTAURANT_NAME ?? "Restaurant";
  const menu = await loadMenuFromDb(prisma).catch(() => null);
  const available = (menu?.items ?? []).filter((i) => i.isAvailable && !i.hasOptions);
  const featured = [...available.filter((i) => i.isFeatured), ...available.filter((i) => !i.isFeatured)].slice(0, 4);
  const hero = featured[0];

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">{restaurantName}<span>.</span></div>
        <SiteNav />
      </header>

      <section className="home-hero">
        <div className="home-hero-copy">
          <div className="eyebrow">Order online</div>
          <h1 className="display"><strong>Fresh food,</strong> ordered your way.</h1>
          <p className="lede">Pick up your order at the counter, or scan the code on your table to order without waiting.</p>
          <div className="cta-row">
            <Link className="btn-primary" href="/menu">Order now</Link>
            <Link className="pill" href="/menu">See the full menu</Link>
          </div>
        </div>

        <div className="card card-brand home-feature" aria-label="Featured dish">
          {hero ? (
            <>
              <div className="eyebrow" style={{ color: "rgba(255,255,255,0.75)" }}>Today&apos;s pick</div>
              <div className="home-feature-name">{hero.name}</div>
              {hero.description ? <p style={{ color: "rgba(255,255,255,0.8)" }}>{hero.description}</p> : null}
              <div className="home-feature-price">{hero.discountPrice ?? hero.price}</div>
              <div style={{ marginTop: 14 }}><AddToCart id={hero.id} name={hero.name} price={hero.discountPrice ?? hero.price} /></div>
            </>
          ) : (
            <>
              <div className="eyebrow" style={{ color: "rgba(255,255,255,0.75)" }}>Today&apos;s pick</div>
              <div className="home-feature-name">Coming soon</div>
              <p style={{ color: "rgba(255,255,255,0.8)" }}>Our menu is being prepared. Check back shortly.</p>
            </>
          )}
        </div>
      </section>

      {featured.length > 0 ? (
        <section style={{ marginTop: 40 }}>
          <div className="section-head">
            <h2>Popular right now</h2>
            <Link className="pill" href="/menu">View all</Link>
          </div>
          <ul className="product-grid">
            {featured.map((item) => (
              <li key={item.id} className="card product">
                {item.imageUrl ? <img className="dish-img" src={item.imageUrl} alt="" loading="lazy" /> : null}
                <h3>{item.name}</h3>
                {item.description ? <p>{item.description}</p> : null}
                <div className="price-row">
                  {item.discountPrice ? (
                    <>
                      <span className="price">{item.discountPrice}</span>
                      <s className="was">{item.price}</s>
                    </>
                  ) : (
                    <span className="price">{item.price}</span>
                  )}
                </div>
                <AddToCart id={item.id} name={item.name} price={item.discountPrice ?? item.price} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="footer">
        {restaurantName} · Pickup and delivery online · Dine-in by scanning the code on your table
      </footer>
    </div>
  );
}
