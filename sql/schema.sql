-- Global Dream Partner Report -- Phase 1 schema.
-- Run this once against your Vercel Postgres (or compatible) database.
-- Only what Phase 1 needs: recording a purchase, and the entitlement it
-- grants. GlobalReport / SavedScenario / ProfileQuestionnaire tables from
-- later phases are intentionally not created yet.

CREATE TABLE IF NOT EXISTS premium_purchases (
  id                        BIGSERIAL PRIMARY KEY,
  purchaser_email           TEXT,
  stripe_session_id         TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id  TEXT,
  entitlement_type          TEXT NOT NULL DEFAULT 'single_report',
  status                    TEXT NOT NULL DEFAULT 'pending', -- pending | completed | refunded
  amount                    INTEGER,   -- minor currency units (e.g. cents)
  currency                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS premium_entitlements (
  id                 BIGSERIAL PRIMARY KEY,
  email              TEXT,
  stripe_session_id  TEXT UNIQUE NOT NULL REFERENCES premium_purchases(stripe_session_id),
  entitlement_type   TEXT NOT NULL DEFAULT 'single_report',
  access_status      TEXT NOT NULL DEFAULT 'active', -- active | revoked
  expires_at         TIMESTAMPTZ,       -- NULL = does not expire (single_report);
                                         -- populated for global_explorer_30_day, etc.
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook idempotency: Stripe can (and will) resend the same event. This
-- table records every processed event ID so stripe-webhook.js can no-op
-- on replays instead of double-granting access.
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  stripe_event_id  TEXT PRIMARY KEY,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_premium_entitlements_session
  ON premium_entitlements (stripe_session_id);

-- Looked up by /api/resend-access-link.js when a returning visitor without
-- persisted access (new device, cleared storage) asks to have their
-- access link re-emailed.
CREATE INDEX IF NOT EXISTS idx_premium_entitlements_email
  ON premium_entitlements (email);
