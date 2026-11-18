// Phase 1 shell. Menu, prices and hours come from the database in Phase 2 — nothing is hardcoded here.
const restaurantName = process.env.RESTAURANT_NAME ?? "Restaurant";

export default function Home() {
  return (
    <>
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            {restaurantName}
            <span>.</span>
          </div>
          <nav className="nav" aria-label="Ordering options">
            <span className="pill is-active" aria-current="page">Delivery</span>
            <span className="pill">Pickup</span>
            <span className="pill">Dine-in</span>
          </nav>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow">Ordering is open</div>
            <h1 className="display">
              <strong>Fresh food,</strong> ordered your way.
            </h1>
            <p className="lede">
              Browse the menu, order for delivery or pickup, or scan the code on your table.
              Every order goes straight to the kitchen.
            </p>
            <div className="cta-row">
              <a className="btn-primary" href="#menu">View menu</a>
            </div>
          </div>

          <div className="status-grid" aria-label="Platform status">
            <div className="card card-brand">
              <h3>Today</h3>
              <p style={{ color: "rgba(255,255,255,0.75)" }}>Opening hours load from settings.</p>
              <div className="big">—</div>
            </div>
            <div className="card">
              <h3>Delivery</h3>
              <p>Zones and fees are set by the restaurant.</p>
            </div>
            <div className="card">
              <h3>Pickup</h3>
              <p>Choose a ready time at checkout.</p>
            </div>
          </div>
        </section>

        <section id="menu" aria-labelledby="menu-heading">
          <h2 id="menu-heading" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Menu</h2>
          <div className="empty">
            The menu appears here once it is loaded from the restaurant database (Phase 2).
          </div>
        </section>

        <footer className="footer">
          Terms · Privacy · Contact — pages arrive in Phase 2.
        </footer>
      </div>
    </>
  );
}
