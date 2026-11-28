//! Tauri backend for Intent Scheduler.
//!
//! Responsibilities:
//! - Register SQL migrations (001–004) on the `sqlite:tracker.db` plugin DB.
//! - Expose filesystem commands used by the Data Vault (save text files,
//!   report DB file size, reveal the DB in Explorer).
//! - Perform vault import/clear inside a single rusqlite transaction on a
//!   dedicated connection — the plugin's connection pool can't span
//!   BEGIN/COMMIT across separate `execute` calls.

use rusqlite::{params_from_iter, types::Value as SqlValue, Connection};
use serde::Serialize;
use serde_json::Value as JsonValue;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:tracker.db";
const DB_FILE_NAME: &str = "tracker.db";

#[derive(Serialize)]
struct DatabaseFileInfo {
    path: String,
    size_bytes: u64,
}

fn database_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    // tauri-plugin-sql resolves "sqlite:tracker.db" against app_config_dir.
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|err| err.to_string())?
        .join(DB_FILE_NAME))
}

fn allowed_text_extension(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.ends_with(".csv") || lower.ends_with(".json")
}

/// Write a CSV/JSON export to a user-picked absolute path. Restricted to
/// `.csv`/`.json` extensions as a guardrail against arbitrary file writes.
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    if !allowed_text_extension(&path) {
        return Err("Only .csv and .json files can be saved".to_string());
    }
    let target = std::path::Path::new(&path);
    if !target.is_absolute() {
        return Err("Save path must be absolute".to_string());
    }
    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    std::fs::write(target, contents).map_err(|err| err.to_string())
}

/// Report the on-disk size of `tracker.db` (+ its WAL) so the Vault health
/// card can show real storage footprint.
#[tauri::command]
fn get_database_file_info(app: tauri::AppHandle) -> Result<DatabaseFileInfo, String> {
    let db_path = database_path(&app)?;
    let mut size_bytes = std::fs::metadata(&db_path)
        .map(|meta| meta.len())
        .unwrap_or(0);
    // Include the WAL file when present so the footprint reflects live data.
    let wal_path = db_path.with_file_name(format!("{}-wal", DB_FILE_NAME));
    if let Ok(meta) = std::fs::metadata(&wal_path) {
        size_bytes += meta.len();
    }
    Ok(DatabaseFileInfo {
        path: db_path.to_string_lossy().to_string(),
        size_bytes,
    })
}

/// Open the DB file's parent folder in the OS file manager. Path is
/// canonicalized and must stay inside the app data dir — prevents the frontend
/// from making Explorer open arbitrary locations.
#[tauri::command]
fn reveal_path_in_explorer(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let data_dir = app
        .path()
        .app_config_dir()
        .map_err(|err| err.to_string())?;
    let target = std::path::Path::new(&path);
    let canonical_dir = data_dir
        .canonicalize()
        .unwrap_or_else(|_| data_dir.clone());
    let canonical_target = target
        .canonicalize()
        .unwrap_or_else(|_| target.to_path_buf());
    if !canonical_target.starts_with(&canonical_dir) {
        return Err("Path is outside the application data directory".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(format!("/select,{}", canonical_target.display()))
            .spawn()
            .map_err(|err| err.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(parent) = canonical_target.parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Vault import: runs entirely inside one rusqlite transaction on a dedicated
// connection. (plugin-sql's pool cannot span BEGIN/COMMIT across execute calls.)
// ---------------------------------------------------------------------------

// Each entry maps the vault JSON key → physical table → allowed columns.
// Column order defines INSERT column/placeholder order.
const VAULT_TABLES: &[(&str, &str, &[&str])] = &[
    ("categories", "categories", &["id", "name", "color_hex", "created_at"]),
    (
        "tasks",
        "tasks",
        &[
            "id",
            "title",
            "category_id",
            "is_recurring",
            "default_duration_mins",
            "target_sessions_per_week",
            "preferred_weekdays",
            "preferred_time",
            "status",
            "notes",
            "priority",
            "created_at",
        ],
    ),
    (
        "scheduleBlocks",
        "schedule_blocks",
        &[
            "id",
            "task_id",
            "scheduled_date",
            "start_time",
            "end_time",
            "planned_duration_mins",
            "notes",
            "status",
            "rolled_from_block_id",
            "created_at",
        ],
    ),
    (
        "timeLogs",
        "time_logs",
        &[
            "id",
            "task_id",
            "schedule_block_id",
            "custom_title",
            "category_id",
            "log_date",
            "start_time",
            "end_time",
            "duration_mins",
            "notes",
            "mood",
            "is_ad_hoc",
            "created_at",
        ],
    ),
    ("settings", "app_settings", &["key", "value", "updated_at"]),
];

// Children before parents so FK constraints don't block the wipe.
const VAULT_DELETE_ORDER: &[&str] = &[
    "time_logs",
    "schedule_blocks",
    "tasks",
    "categories",
    "app_settings",
];

// JSON → SQLite value coercion. Objects/arrays can't be represented in the
// schema, so they degrade to NULL (frontend validation already filters them).
fn json_to_sql(value: &JsonValue) -> SqlValue {
    match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(i64::from(*b)),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqlValue::Real(f)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        _ => SqlValue::Null,
    }
}

#[derive(Serialize)]
struct VaultTableStats {
    attempted: usize,
    written: usize,
}

#[derive(Serialize)]
struct VaultImportStats {
    tables: Vec<(&'static str, VaultTableStats)>,
}

/// Restore a validated vault payload.
/// - `merge`: INSERT OR IGNORE — existing UUIDs are skipped, nothing is deleted.
/// - `replace`: DELETE all tables first, then plain INSERT.
/// Any error aborts the closure → `tx` drops → automatic rollback, so the DB
/// is never left half-imported.
#[tauri::command]
fn import_vault(app: tauri::AppHandle, data: JsonValue, mode: String) -> Result<VaultImportStats, String> {
    if mode != "merge" && mode != "replace" {
        return Err(format!("Unknown import mode: {mode}"));
    }
    let db_path = database_path(&app)?;
    let mut conn = Connection::open(&db_path)
        .map_err(|err| format!("Cannot open database {}: {err}", db_path.display()))?;

    let tx = conn
        .transaction()
        .map_err(|err| format!("Cannot begin import transaction: {err}"))?;

    let mut stats: Vec<(&'static str, VaultTableStats)> = Vec::new();

    let result = (|| -> Result<(), String> {
        if mode == "replace" {
            for table in VAULT_DELETE_ORDER {
                tx.execute(&format!("DELETE FROM {table}"), [])
                    .map_err(|err| format!("Failed clearing {table}: {err}"))?;
            }
        }

        for (key, table, columns) in VAULT_TABLES {
            let rows = data
                .get(*key)
                .and_then(JsonValue::as_array)
                .ok_or_else(|| format!("Vault data is missing \"{key}\" array"))?;
            let mut table_stats = VaultTableStats {
                attempted: rows.len(),
                written: 0,
            };
            if !rows.is_empty() {
                let column_list = columns.join(", ");
                let placeholders = columns
                    .iter()
                    .enumerate()
                    .map(|(i, _)| format!("?{}", i + 1))
                    .collect::<Vec<_>>()
                    .join(", ");
                let insert_verb = if mode == "merge" { "INSERT OR IGNORE" } else { "INSERT" };
                let sql = format!("{insert_verb} INTO {table} ({column_list}) VALUES ({placeholders})");
                let mut stmt = tx
                    .prepare(&sql)
                    .map_err(|err| format!("Failed preparing insert for {table}: {err}"))?;
                for (index, row) in rows.iter().enumerate() {
                    let obj = row
                        .as_object()
                        .ok_or_else(|| format!("{table} row {} is not an object", index + 1))?;
                    let values: Vec<SqlValue> = columns
                        .iter()
                        .map(|column| obj.get(*column).map(json_to_sql).unwrap_or(SqlValue::Null))
                        .collect();
                    let affected = stmt
                        .execute(params_from_iter(values))
                        .map_err(|err| format!("Failed inserting into {table} row {}: {err}", index + 1))?;
                    table_stats.written += affected;
                }
            }
            stats.push((*table, table_stats));
        }
        Ok(())
    })();

    match result {
        Ok(()) => tx
            .commit()
            .map_err(|err| format!("Failed committing import: {err}"))
            .map(|_| VaultImportStats { tables: stats }),
        Err(err) => Err(err), // tx drops here -> automatic rollback
    }
}

/// Factory reset: DELETE every table in child→parent order inside one
/// transaction. Default categories/settings re-seed on next app bootstrap.
#[tauri::command]
fn clear_vault(app: tauri::AppHandle) -> Result<(), String> {
    let db_path = database_path(&app)?;
    let mut conn = Connection::open(&db_path)
        .map_err(|err| format!("Cannot open database {}: {err}", db_path.display()))?;

    let tx = conn
        .transaction()
        .map_err(|err| format!("Cannot begin clear transaction: {err}"))?;

    let result = (|| -> Result<(), String> {
        for table in VAULT_DELETE_ORDER {
            tx.execute(&format!("DELETE FROM {table}"), [])
                .map_err(|err| format!("Failed clearing {table}: {err}"))?;
        }
        Ok(())
    })();

    match result {
        Ok(()) => tx
            .commit()
            .map_err(|err| format!("Failed committing clear: {err}")),
        Err(err) => Err(err), // tx drops here -> automatic rollback
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ordered migrations applied by tauri-plugin-sql on first DB open.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_planner_state_fields",
            sql: include_str!("../migrations/002_planner_state.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_weekly_habit_analytics_fields",
            sql: include_str!("../migrations/003_weekly_habit_analytics.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_habit_preferred_time",
            sql: include_str!("../migrations/004_habit_preferred_time.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            save_text_file,
            get_database_file_info,
            reveal_path_in_explorer,
            import_vault,
            clear_vault
        ])
        .run(tauri::generate_context!())
        .expect("error while running Intent Scheduler");
}
