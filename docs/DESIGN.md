# Visual system

Derived from two reference screens:

1. Restoo owner dashboard — clean light UI, teal hero stat card, orange and black chart series, grouped sidebar.
2. Cravk mobile food app — large food photography, bold-plus-light headlines, pill chips, black CTA, red-orange prices.

Tokens live in `apps/web/app/globals.css` (`--canvas`, `--surface`, `--ink`, `--brand`, `--accent`, `--price`, radii, shadows). Dark mode is supported through `prefers-color-scheme` and the `data-theme` attribute.

Rules to keep the look consistent:
- Headlines: a bold word followed by a light word on the same line.
- Selectors: pill chips; the active chip is solid ink.
- Primary action: one full-width black pill per screen.
- Prices in `--price`; secondary text in `--muted`.
- Cards: 20px radius, soft shadow, no borders.
