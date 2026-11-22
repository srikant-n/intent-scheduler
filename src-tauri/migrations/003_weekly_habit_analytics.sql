-- Habit cadence targets and preferred weekdays for recurring intentions.
ALTER TABLE tasks ADD COLUMN target_sessions_per_week INTEGER;
ALTER TABLE tasks ADD COLUMN preferred_weekdays TEXT;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_task_date
    ON schedule_blocks(task_id, scheduled_date);
