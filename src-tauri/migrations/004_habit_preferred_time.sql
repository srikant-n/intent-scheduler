-- Preferred start time for recurring intentions, used by weekly habit distribution.
ALTER TABLE tasks ADD COLUMN preferred_time TEXT;
