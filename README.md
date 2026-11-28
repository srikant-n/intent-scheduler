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

- **Daily dual-track view** — side-by-side "Planned" (Intent) and "Actuals" (Reality) timelines with a shared time ruler, live "now" marker, category badges, On-Intent/Unplanned chips, and planned-vs-actual variance on each block; drag Intentions onto time-blocked grid slots snapped to 15/30-minute intervals.
- **Weekly planner board** — horizontally scrollable Monday–Sunday columns with per-weekday capacity bars, exact `HH:MM` block cards, status styling, linked actual minutes/variance, drag-and-drop intention scheduling and block moves with overlap confirmation.
- **Per-weekday capacity** — editable minute targets per ISO weekday stored as JSON in `app_settings` (`weekly_capacity_minutes`), seeded with Mon–Fri 180 / Sat 120 / Sun 90.
- **Habit distribution** — recurring intentions carry `target_sessions_per_week` plus optional preferred ISO weekdays; the distribution modal previews deficit-filling proposals within remaining capacity before writing non-duplicate blocks.
- **Batch weekly rollover** — pending blocks (past end time, no linked actual minutes) can be moved +1 day, moved to next Monday, rescheduled, dismissed, or returned to the backlog; every move preserves `rolled_from_block_id` lineage.
- **Weekly CSV export** — one enriched row per schedule block for the Mon–Sun week, saved via the native save dialog through a `.csv`-only Rust command.

### Actual Task & Time Logging (Reality)

- **One-click execution confirmation** — convert a planned block into an actual time log, with optional inline duration adjustments.
- **Active floating timer** — persistent timer pill pinned to the bottom of the window with pause/resume, elapsed clock, and optional target duration; auto-persists to `time_logs` on stop.
- **Manual & unplanned logging** — quick-log ad-hoc activities ("Rest/Break", "Errands", "Social") via explicit start/end times or direct durations (e.g., "45 mins").
- **Mood tags** — optional energy classification on logs (`restorative`, `energizing`, `distraction`, `firefight`) for reflection analytics.
- **Block lifecycle states** — `planned` / `completed` / `missed` / `dismissed` / `rolled`, with `rolled_from_block_id` lineage preserved across rollovers.

### Daily & Weekly Time Analytics

- Week-scoped dashboard (previous/next/this week) with KPI grid, per-category planned-vs-actual variance and tendency labels, stacked daily category chart, Mon–Sun planned-vs-actual rhythm with a per-day variance table, estimation drift grading with task-level bias detection, rollover analytics, and deterministic local reflection insights (no external services).

### Data Portability & Vault

- **JSON backup** — full dump of settings, categories, tasks, schedule blocks, and logs (`schemaVersion`, `exportedAt`, `appVersion`) with a size preview before download.
- **JSON restore** — schema-validated import executed inside a single SQLite transaction on the Rust side: **Replace** (atomic full restore, default) or **Merge** (`INSERT OR IGNORE`) modes.
- **CSV exports** — flattened time-log report (all time / this month / last 30 days) for Excel/Google Sheets, plus a per-week enriched schedule-block CSV from the weekly planner.
- **Storage health** — live database file size (incl. WAL), row counts per table, `PRAGMA integrity_check`, journal/synchronous/foreign-key pragmas, last export/import timestamps, and "reveal in Explorer".
- **Clear vault** — transactional wipe of all app data with the same rollback guarantees as import.

### Appearance & Themes

- Light / Dark / Auto (follow Windows) modes plus six accent presets (Ember, Indigo, Emerald, Rose, Violet, Graphite) selectable from the sidebar.
- Preferences persisted in the local `app_settings` table, applied instantly via CSS variables and Tailwind dark mode — no restarts.
- Plus Jakarta Sans variable font bundled locally.

## Views

| View | Key Interactions | Data Sources |
| --- | --- | --- |
| Dual-Track Today | Drag task to timeline, click-to-confirm block, resize blocks, end-of-day rollover | `schedule_blocks`, `time_logs`, `tasks` |
| Weekly Planner | Assign tasks to time slots across 7-day grid, batch-move incomplete blocks, habit distribution, weekly CSV export | `schedule_blocks`, `tasks` |
| Intentions | Create/edit tasks, toggle recurring + habit cadence, manage categories | `tasks`, `categories` |
| Time Analytics | Week-scoped KPIs, variance charts, estimation drift, reflection insights | `time_logs`, `schedule_blocks`, `categories` |
| Data Vault | JSON export/restore, CSV logs, storage health, clear all data | all tables + `app_settings` |

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Desktop shell | Tauri v2 (Rust core) + WebView2 | Native Windows app, ~10 MB `.msi` distribution |
| Frontend | React 19 + TypeScript + Tailwind CSS | Type-safe UI with Lucide icons |
| Data orchestration | TanStack Query v5 | Caching, optimistic updates, reactive state over IPC |
| Database | SQLite via `tauri-plugin-sql` | Local ACID database in `%APPDATA%/intent-tracker/tracker.db` (WAL mode) |
| System integration | `tauri-plugin-dialog`, `tauri-plugin-fs`, custom Rust commands | Native file dialogs, `.csv`/`.json`-only `save_text_file`, vault import/clear transactions, DB health probes |

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
[ Embedded SQLite Engine ] ──► %APPDATA%/intent-tracker/tracker.db
```

## Database Schema

All primary keys are UUID v4 strings; dates (`YYYY-MM-DD`) and timestamps (ISO-8601) are stored as text.

Schema evolves via `src-tauri/migrations/` (currently v1–v4):

- **`app_settings`** — key/value preferences (theme, accent, weekly capacity JSON, vault event timestamps)
- **`categories`** — `id`, `name` (unique), `color_hex`, `created_at`
- **`tasks`** (Intentions) — `id`, `title`, `category_id`, `is_recurring`, `default_duration_mins`, `target_sessions_per_week`, `preferred_weekdays` (JSON array), `preferred_time` (`HH:MM`), `status` (`active`/`archived`), `notes`, `priority`, `created_at`
- **`schedule_blocks`** — the *intent*: `task_id`, `scheduled_date`, `start_time`, `end_time`, `planned_duration_mins`, `notes`, `status` (`planned`/`completed`/`missed`/`dismissed`/`rolled`), `rolled_from_block_id`
- **`time_logs`** — the *reality*: nullable `task_id`/`schedule_block_id`/`custom_title`/`category_id` (supports ad-hoc logs), `log_date`, `start_time`, `end_time`, `duration_mins`, `notes`, `mood`, `is_ad_hoc`, `created_at`

Indexes cover `scheduled_date`, `(status, scheduled_date)`, `log_date`, `schedule_block_id`, and `(task_id, scheduled_date)` for fast range filtering.

## JSON Import / Export

Backup payload shape: `{ metadata: { schemaVersion, exportedAt, appVersion }, data: { settings, categories, tasks, scheduleBlocks, timeLogs } }` (`VAULT_SCHEMA_VERSION = 1`). Frontend validation (`src/utils/vault.ts`) checks structure, referential integrity, enums, and date/time formats before import; the actual write runs as a single rusqlite transaction in `src-tauri/src/lib.rs` (`import_vault` / `clear_vault` commands) — any violation rolls back completely. See §6 of the spec for the original schema example.

## Getting Started

Requires Node.js and Rust (for the Tauri shell).

```bash
npm install
npm run dev          # Vite frontend only (browser dev)
npm run tauri:dev    # Full desktop app with hot reload
npm run build        # Typecheck + production frontend build
npm run tauri:build  # Windows installer (.msi/.exe)
npm test             # Vitest unit/component tests
npm run typecheck    # tsc --noEmit
```

## Project Structure

```
intent-scheduler/
├── src-tauri/
│   ├── migrations/            # 001_initial_schema … 004_habit_preferred_time
│   └── src/lib.rs             # Custom commands: save_text_file, vault import/clear, DB health
├── src/
│   ├── components/
│   │   ├── analytics/         # KPI grid, variance, stacked/rhythm charts, drift, insights
│   │   ├── common/            # Button, Modal, Badge, Field, EmptyState
│   │   ├── daily/             # Dual-track timeline, quick-log/schedule/log/rollover modals
│   │   ├── intentions/        # Intention + category management modals
│   │   ├── layout/            # Sidebar, TopBar, ActiveTimerBar
│   │   ├── settings/          # Theme selector
│   │   ├── vault/             # Health, export, restore, clear cards
│   │   └── weekly/            # Board, day columns, habit pool/distribution, capacity, rollover
│   ├── db/{client.ts, queries.ts}
│   ├── hooks/                 # useSchedule, useIntentions, useLogs, useActiveTimer, useTheme,
│   │                          # useCategories, useWeeklyCapacity, useVault, useDragScroll
│   ├── pages/                 # DailyPage, WeeklyPage, IntentionsPage, AnalyticsPage, VaultPage
│   ├── theme/                 # CSS variables + accent presets
│   ├── types/{database.ts, analytics.ts}
│   ├── utils/                 # planner, schedule, weekly, capacity, habitDistribution,
│   │                          # analytics, time, csv, vault, enrich, fileExport, dragContext
│   ├── test/setup.ts
│   └── App.tsx, main.tsx, index.css
├── package.json
└── tsconfig.json
```

## Implementation Status

All five spec phases are implemented: foundation, planning engine, execution tracking, analytics, and data portability (JSON vault + CSV + health). Remaining: production Windows installer packaging/verification and any final polish.

## License

Private project — all rights reserved.
