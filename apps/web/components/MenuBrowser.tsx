"use client";

import { useMemo, useState } from "react";
import type { WebMenuData, MenuItemView } from "../lib/catalog-source";
import { AddToCart } from "./AddToCart";

export function MenuBrowser({ menu }: { menu: WebMenuData }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | "all">("all");

  const visible = useMemo<MenuItemView[]>(() => {
    const q = query.trim().toLowerCase();
    return menu.items.filter((item) => {
      if (!item.isAvailable) return false;
      if (categoryId !== "all" && item.categoryId !== categoryId) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q);
    });
  }, [menu.items, query, categoryId]);

  if (menu.source === "unavailable") {
    return (
      <div className="empty" role="status">
        The menu could not be loaded right now. Please try again in a moment.
      </div>
    );
  }

  return (
    <div>
      <div className="menu-tools">
        <label className="sr-only" htmlFor="menu-search">Search the menu</label>
        <input
          id="menu-search"
          className="search"
          type="search"
          placeholder="Search dishes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="nav" role="group" aria-label="Filter by category">
          <button type="button" className="pill" aria-pressed={categoryId === "all"} onClick={() => setCategoryId("all")}>
            All
          </button>
          {menu.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="pill"
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {menu.items.length === 0 ? (
        <div className="empty">No dishes have been added to the menu yet.</div>
      ) : visible.length === 0 ? (
        <div className="empty">Nothing matches your search.</div>
      ) : (
        <ul className="product-grid">
          {visible.map((item) => (
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
              {item.hasOptions ? (
                <button type="button" className="btn-add" disabled>Options coming soon</button>
              ) : (
                <AddToCart id={item.id} name={item.name} price={item.discountPrice ?? item.price} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
