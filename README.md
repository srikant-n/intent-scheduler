# intent-scheduler

Schedule and track intentions and compare to reality.

A Personal Task & Time Tracker built around the **"Intent vs. Reality"** paradigm: it contrasts your planned daily/weekly time schedules against actual task execution and time spent, enabling precise behavioral reflection and scheduling adjustments over time.

See the full specification in [`Docs/Personal Task & Time Tracker - Application Design & Technical Specification.docx`](Docs/Personal%20Task%20%26%20Time%20Tracker%20-%20Application%20Design%20%26%20Technical%20Specification.docx) (v1.0).

---

## Core Design Goals

- **Zero runtime dependencies** — native Windows execution via Tauri v2 and system WebView2; standalone `.msi`/`.exe` installer under ~15 MB with no Node runtime or local server prerequisites.
- **Zero-friction daily logging** — minimal click depth for converting planned blocks to actual logs, plus rapid shortcuts for logging spontaneous activities.
- **Flexible activity modeling** — native support for one-off tasks and recurring/habitual intentions.
- **Complete data ownership** — all data stored locally in standard SQLite format with JSON and CSV export/import (zero vendor lock-in).
- **Customizable visual themes** — Light, Dark, and System theme modes with accent color presets, persisted locally and applied instantly without reloads.

## Features

### Intentions (the "Menu")

- Flat categorized task list with custom hex color coding (no nested subtasks) for fast scanning and drag-and-drop scheduling.
- **One-off tasks** — discrete objectives, automatically archived on completion.
- **Recurring/habitual activities** — stay active in the backlog across planning periods for repeated weekly allocation.
- Default estimated durations (minutes) to speed up schedule creation.

### Daily & Weekly Schedule Planner (Intent)

- **Daily dual-track view** — side-by-side "Planned" and "Actuals" timelines; drag Intentions onto time-blocked grid slots snapped to 15/30-minute intervals.
- **Weekly planner board** — horizontally scrollable Monday–Sunday columns with per-weekday capacity bars, exact `HH:MM` block cards, status styling, linked actual minutes/variance, drag-and-drop intention scheduling and block moves with overlap confirmation.
- **Per-weekday capacity** — editable minute targets per ISO weekday stored as JSON in `app_settings` (`weekly_capacity_minutes`), seeded with Mon–Fri 360 / Sat 240 / Sun 180.
- **Habit distribution** — recurring intentions carry `target_sessions_per_week` plus optional preferred ISO weekdays; the distribution modal previews deficit-filling proposals within remaining capacity before writing non-duplicate blocks.
- **Batch weekly rollover** — pending blocks (past end time, no linked actual minutes) can be moved +1 day, moved to next Monday, rescheduled, dismissed, or returned to the backlog; every move preserves `rolled_from_block_id` lineage.
- **Weekly CSV export** — one enriched row per schedule block for the Mon–Sun week, saved via the native save dialog through a `.csv`-only Rust command.

### Actual Task & Time Logging (Reality)

- **One-click execution confirmation** — convert a planned block into an actual time log, with optional inline duration adjustments.
- **Active floating timer** — persistent timer pill pinned to the bottom of the window; auto-persists to `time_logs` on stop.
- **Manual & unplanned logging** — quick-log ad-hoc activities ("Rest/Break", "Errands", "Social") via explicit start/end times or direct durations (e.g., "45 mins").

### Daily & Weekly Time Analytics

- Week-scoped dashboard (previous/next/this week) with KPI grid, per-category planned-vs-actual variance and tendency labels, stacked daily category chart, Mon–Sun planned-vs-actual rhythm, estimation drift grading with task-level bias detection, rollover analytics, and deterministic local reflection insights (no external services).

### Data Portability

- **JSON backup** — full dump of settings, categories, tasks, schedule blocks, and logs with `schemaVersion` and ISO timestamps.
- **JSON restore** — atomic SQLite transaction swap (Overwrite/Full Restore, default) or optional Merge mode (`INSERT OR IGNORE`).
- **CSV export** — flattened query output for Excel/Google Sheets reporting.

### Appearance & Themes

- Light / Dark / Follow-Windows-System modes plus customizable accent colors.
- Preferences persisted in the local `app_settings` table, applied instantly via CSS variables and Tailwind dark mode — no restarts.

## Views

| View | Key Interactions | Data Sources |
| --- | --- | --- |
| Dual-Track Daily Planner | Drag task to timeline, click-to-confirm block, resize blocks | `schedule_blocks`, `time_logs`, `tasks` |
| Weekly Planner | Assign tasks to time slots across 7-day grid, batch-move incomplete blocks | `schedule_blocks`, `tasks` |
| Intentions | Create/edit tasks, toggle recurring, archive completed | `tasks`, `categories` |
| Time & Reflection Dashboard | Filter by date range, export CSV, view category distribution | `time_logs`, `schedule_blocks`, `categories` |

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Desktop shell | Tauri v2 (Rust core) + WebView2 | Native Windows app, ~10 MB `.msi` distribution |
| Frontend | React 19 + TypeScript + Tailwind CSS | Type-safe UI with Lucide icons |
| Data orchestration | TanStack Query v5 | Caching, optimistic updates, reactive state over IPC |
| Database | SQLite via `tauri-plugin-sql` | Local ACID database in `%APPDATA%/intent-tracker/tracker.db` |
| System integration | `tauri-plugin-dialog`, `tauri-plugin-fs` | Native file dialogs for backup import/export |

## Data Flow

```
[ React 19 UI Layer ]
       │  ▲
       │  │ TypeScript Queries / IPC Commands
       ▼  │
[ Tauri v2 IPC Bridge ]
       │  ▲
       │  │ Rust Native Plugin Handlers
       ▼  │
[ Embedded SQLite Engine ] ──► %APPDATA%/intent-scheduler/tracker.db
```

## Database Schema

All primary keys are UUID v4 strings; dates (`YYYY-MM-DD`) and timestamps (ISO-8601) are stored as text.

- **`app_settings`** — key/value preferences (theme, accent color, etc.)
- **`categories`** — `id`, `name` (unique), `color_hex`, `created_at`
- **`tasks`** — `id`, `title`, `category_id`, `is_recurring`, `default_duration_mins`, `status` (`active`/archived)
- **`schedule_blocks`** — the *intent*: `task_id`, `scheduled_date`, `start_time`, `end_time`, `planned_duration_mins`, `notes`
- **`time_logs`** — the *reality*: nullable `task_id`/`schedule_block_id`/`custom_title`/`category_id` (supports ad-hoc logs), `log_date`, `start_time`, `end_time`, `duration_mins`, `notes`

Indexes on `schedule_blocks(scheduled_date)` and `time_logs(log_date)` for fast range filtering. See the spec doc for full DDL.

## JSON Import / Export

Backup payload shape: `{ metadata: { schemaVersion, exportedAt, appVersion }, data: { settings, categories, tasks, scheduleBlocks, timeLogs } }`. Imports are schema-validated and run inside a single SQLite transaction — any violation rolls back completely. See §6 of the spec for the full schema example and validation rules.

## Project Structure (planned)

```
tracker-app/
├── src-tauri/
│   ├── migrations/001_initial_schema.sql
│   └── src/{lib.rs, main.rs}
├── src/
│   ├── components/{common,daily,layout,settings,weekly}/
│   ├── db/{client.ts, queries.ts}
│   ├── hooks/{useActiveTimer,useSchedule,useTheme}.ts
│   ├── pages/{IntentionsPage,DailyPage,DashboardPage,WeeklyPage}.tsx
│   ├── types/database.ts
│   ├── utils/exportImport.ts
│   └── App.tsx, main.tsx
├── package.json
└── tsconfig.json
```

## Implementation Milestones

1. **Foundation** — Tauri v2 + React + TS + Tailwind scaffolding, SQLite migrations, theme engine, Intentions CRUD.
2. **Planning engine** — daily dual-track timeline, drag-and-drop scheduling, weekly grid, rollover workflows.
3. **Execution tracking** — floating active timer, block-to-log conversion, ad-hoc/duration-only quick logging.
4. **Analytics** — category summaries, weekly stacked charts, plan-vs-actual variance.
5. **Release packaging** — JSON backup/restore, CSV export, Windows `.msi`/`.exe` build via Tauri CLI.

## Status

Daily planner, intentions, weekly planner (capacity, habit distribution, batch rollover, CSV export), and week-scoped analytics are implemented. Data Vault (JSON backup/restore) remains planned.
