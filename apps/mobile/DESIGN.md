# Mobile app design reference

Reference: the "Cravk – Food Details & Cart Mobile App UI" shot on Dribbble. The customer app should follow its layout and feel. Colours stay the restaurant's own teal (see `src/theme.ts`), as the owner asked to keep the brand colours.

## Dish detail
- Large food photo filling the top of the screen, with round back and favourite buttons floating over it.
- Title in two weights: a bold first word and a light rest of the name.
- Price in large type with an accent colour, beside the name.
- Quick info row: delivery, prep time, calories.
- Size chooser as small pills (Small, Medium, Large, Extra large) with the selected one filled black.
- "Often order with" row of small photos below the description.
- Bottom bar: an outlined "Add to cart" button next to a solid "Order" button.

## Cart
- Each line is a card: thumbnail, name, short description, accent-coloured price.
- Quantity stepper with round − and + buttons, and a red delete icon for the line.
- Promo code field with an Apply button.
- Order summary (subtotal, delivery, total) above a full-width solid "Checkout" button.

## Style
- Light off-white background, white cards with soft corners.
- Solid dark pill buttons for the main action; outlined pills for secondary.
- Generous spacing, one main action per screen, icons only where they help.
