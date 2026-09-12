# Bubble It customer tracking design

The live bus experience extends the production account UI in `app/globals.css`. The implemented site is authoritative over the older design system draft.

- Visual language: white commerce cards, navy structure, cyan live accents, soft sky status surfaces, 20 pixel card radii, and existing shadows.
- Typography: Space Grotesk headings, DM Sans body text, and IBM Plex Sans Arabic for RTL.
- Layout: the authenticated booking panel stays inside the Account page. On wide screens the map and status rail sit side by side; on narrow screens they stack without horizontal scrolling.
- Motion: the post-payment dispatch sequence always presents progress, even after a fast assignment. Motion is limited to the four-step status presentation and bounded marker interpolation, with the existing reduced-motion override respected.
- Privacy: precise map and location text are blocked from replay capture. Coordinates, stream grants, and channel names never enter URLs or browser storage.
- Accessibility: all map information has an equivalent text status, state changes use polite live regions, controls keep 44 pixel minimum targets, and color is never the sole status indicator.
