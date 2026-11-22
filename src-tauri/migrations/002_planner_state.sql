-- Planner state and lightweight reflection metadata needed by the daily workflow.
ALTER TABLE tasks ADD COLUMN notes TEXT;
ALTER TABLE tasks ADD COLUMN priority TEXT;

ALTER TABLE schedule_blocks ADD COLUMN status TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE schedule_blocks ADD COLUMN rolled_from_block_id TEXT;

ALTER TABLE time_logs ADD COLUMN mood TEXT;
ALTER TABLE time_logs ADD COLUMN is_ad_hoc INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_status_date
    ON schedule_blocks(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_time_logs_schedule_block
    ON time_logs(schedule_block_id);
