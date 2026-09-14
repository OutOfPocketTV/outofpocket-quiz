# Orbit UI experiment

Branch: `experiment/ui-revamp`. Based on `f8e6601` on `master`. This branch is for comparing a new design; it does not replace the production branch.

The experiment introduces a custom lightweight SVG globe, a new landing page, two-column desktop preferences, a live preference summary, clearer paid-report messaging, report benefits and FAQs, and responsive styles for phones. The report and paywall share the new palette. Original quiz controls, defaults, calculations, datasets, localized Stripe pricing, payment mounts, access restoration, social feed, analytics events, and full/short paywall assignment are preserved.

## Preview

Use the Vercel preview deployment for this branch. Do not change the production branch or merge until the design is approved. Vercel preview environment variables must include the services needed for payment and access restoration; those cannot be validated by a static server. For local full-stack development, use the existing `npm run dev` workflow with the Vercel CLI and project environment configured.

The old `?edit=1` editor is not loaded in this layout, because it expects a flat list of sections and publishes to `master`. The dashboard API rejects all `edit-*` actions on Vercel preview deployments. Production dashboard behavior is unchanged. Edit this experiment through its Git branch.

## Compare behavior

- `?paywall=full` and `?paywall=short` still select the existing paywall variants for inspection.
- GA4 receives `ui_version: orbit_v1` on this design. Register an event-scoped custom dimension for that parameter to compare versions in GA4. The existing paywall variant remains a separate parameter. This branch does not randomly split production traffic.
- Compare purchases per visitor, calculator submissions, paywall opens and checkout starts, broken down by device and traffic source. A visual improvement alone is not evidence of increased sales.

## Validation

- Retained all 156 original element IDs and 65 original form controls, including their types, defaults, ranges and values.
- Matched 2,751 calculator, report and data cases across 198 countries, U.S. states and metros, and eight preference sets against `master`.
- Tested preview editor isolation in 48 mocked cases, including unchanged production behavior; no real publish requests were made.
- Browser checks: desktop, 390px and 320px phone layouts; multi-select and “Any” fallback; sex-specific exclusion; keyboard ranges; preference summary; full and short paywalls; live localized price loading; expansion, close/Escape, restore form and hidden locked results.
- No real purchase or restore email was submitted. Live end-to-end payment, wallet availability, webhook delivery and returning paid access still need verification in a correctly configured Vercel preview with test credentials.

Presentation files are `redesign.css`, `redesign.js`, `assets/possibility-orbit.svg` and the revised `index.html`. The only server change is the preview editor guard.
