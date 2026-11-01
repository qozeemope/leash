# UI rules for the Leash frontend

These rules apply to every page and component. `npm test` enforces the ones marked (tested).

## Content and tone
- Objective, clear, concise, solution-oriented. No filler, no faux enthusiasm, no drama.
- Never use: "Oops", "Uh-oh", "Hurray", "Success!", "Successfully", "It looks like", "We are working on it", "Something went wrong". (tested)
- No exclamation points in any interface text. (tested)
- Errors: statement of the problem, then a brief plain-language reason, then a clear way out. Never blame the user. Use `ErrorNotice`.
- Notifications: status, object, result, under two lines. Example: "Rule signed". Use `Notice` with a `title`.
- Empty states: value-focused headline, one educational sentence, one primary button. Use `EmptyState`.

## Visual design
- Late-90s mail-order storefront: navy masthead, folder-tab navigation, window-style box titles, beveled grey buttons, thermal-paper receipts, rubber stamps, hazard-striped sandbox strip.
- Colour signals intent or state only. Web-safe 216 palette. Hex values live only in `:root` of `src/styles/retro.css`. (tested)
- Every text and background pair meets WCAG AA, at least 4.5 to 1. (tested)
- No Tailwind utility classes in JSX. Tailwind supplies only the reset. All styling uses tokens and class names from `retro.css`.

## Branding and icons
- No emoji, pictographs or symbol characters anywhere. Icons are inline SVG from `shared/ui/Icon.tsx`. (tested)
- The logo is a geometric mark plus a Georgia wordmark.

## Accessibility
- Semantic HTML, ARIA only where HTML cannot express the meaning.
- Visible focus ring on any background (gold ring inside an ink ring).
- Interactive targets are at least 44px tall, including small buttons. (tested)
- Focus moves to the main content on every route change.
- Never rely on colour alone: outcomes use icon, text and colour.
