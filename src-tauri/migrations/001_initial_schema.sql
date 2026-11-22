-- Enable Foreign Key constraints
PRAGMA foreign_keys = ON;

-- App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    color_hex TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    category_id TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    default_duration_mins INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Schedule Blocks (Intent)
CREATE TABLE IF NOT EXISTS schedule_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL,
    scheduled_date TEXT NOT NULL, -- Format: YYYY-MM-DD
    start_time TEXT NOT NULL,    -- Format: HH:MM
    end_time TEXT NOT NULL,      -- Format: HH:MM
    planned_duration_mins INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Time Logs (Reality)
CREATE TABLE IF NOT EXISTS time_logs (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT,
    schedule_block_id TEXT,
    custom_title TEXT,
    category_id TEXT,
    log_date TEXT NOT NULL,     -- Format: YYYY-MM-DD
    start_time TEXT,             -- Format: HH:MM
    end_time TEXT,               -- Format: HH:MM
    duration_mins INTEGER NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL,
    FOREIGN KEY(schedule_block_id) REFERENCES schedule_blocks(id) ON DELETE SET NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Indices for rapid query range filtering
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_time_logs_date ON time_logs(log_date);
