-- ============================================================
-- Migration: 001_add_shift_duty_hours.sql
--
-- Adds a configurable duty_hours field to shifts, required so that the
-- present/late attendance rule (actual working hours vs shift duty hours)
-- is never hardcoded per shift-type in application code.
--
-- Safe to run on an existing database:
--   - Uses IF NOT EXISTS, so re-running it is a no-op.
--   - Does not drop or recreate any table.
--   - Does not touch employees or attendance data.
--   - Existing shifts are backfilled with an 8-hour default; update them
--     individually afterwards from the admin Shift Management page.
-- ============================================================

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS duty_hours NUMERIC(4,2) NOT NULL DEFAULT 8;

COMMENT ON COLUMN shifts.duty_hours IS
  'Required working hours for this shift. Used to determine present vs late: '
  'actual_working_hours >= duty_hours => present, otherwise => late.';
