# Shared customer UI

## Overview

Navigation, shared controls, feedback, responsive layout, and accessibility.

Paths in code and commands are relative to the repository root. These rules also apply to callers outside this directory.

## Shared presentation

- Global navigation is Services, Memberships, Store, Account with one dominant Book a Wash CTA. Keep the compact language switcher directly in the header at every viewport, beside the mobile menu rather than inside it.
- A closed mobile menu is `aria-hidden` and `inert`. Account section controls follow ARIA tabs: one tab stop, `aria-selected`, linked panels, arrow keys, Home/End, and no clipped mobile tabs. Each rendered account state has one page h1.
- Deep Bubble uses the same prominent Popular badge and cyan emphasis on homepage services and booking selection.
- Use the shared accessible dismissible top snackbar for comparable action errors in booking, auth, memberships, checkout, locations, notifications, reviews, and deletion. Coverage information uses its fixed non-danger snackbar, visible at any scroll position.
- App owned strings, including accessible names, validation, errors, option labels, generated defaults, legal chrome, and metadata, come from the bilingual catalog. Preserve customer and backend authored catalogue names verbatim.
- Preserve responsive skeletons for services, products, memberships, availability, and other server backed regions instead of blank space or generic loading text.
- Customer tracking stays on Looking for your bus until the authoritative assignment exists, then
  deliberately shows every found/assigning/assigned stage once per tab session even for instant
  allocation. Precise map data appears only from an eligible snapshot. Keep truthful no map, stale,
  disconnected, route unavailable and terminal fallbacks in both languages.
- Reuse one Google map instance and move the bus marker in place. Respect reduced motion, pause live
  sockets while hidden/offline, recover event gaps from a snapshot, and never fabricate a route line
  or ETA. A missing/blocked map must leave status and bus details usable.

## Accessibility

- Release gates cover English/Arabic, server rendered lang/dir, RTL, 320px reflow, increased text, keyboard navigation, visible focus, focus restoration, reduced motion, and axe WCAG A/AA. Normal text meets AA contrast; mobile targets are at least 44×44px.
- `LocationMap` has a localized keyboard/screen reader coordinate form. Dragging and geolocation permission are not the only inputs. Modal dialogs trap focus and return it to the invoking control.
- Hour popovers use document portals, measure/clamp to the visual viewport, reposition on scroll/resize, and open upward when constrained. Outside click and focus restoration must work across the portal; grid alignment alone does not protect narrow screens or large text.
- Respect `prefers-reduced-motion`. Use opacity/transform entrances without retaining transformed ancestors around fixed controls. Avoid long scripted scrolling and continuous decorative checkout animation.
- `tests/e2e/accessibility.spec.ts` is blocking. Fix semantics/contrast rather than suppressing axe unless a false positive is documented.

## Related context

- [Booking, membership, and loyalty UX](booking/AGENTS.md)
- [Store and checkout UX](store/AGENTS.md)
- [Locale, Qatar time, and shared eligibility](../lib/AGENTS.md)
- [Account and session boundaries](../app/AGENTS.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
