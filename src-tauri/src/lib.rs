use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:tracker.db";

#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    if !path.to_lowercase().ends_with(".csv") {
        return Err("Only .csv files can be saved".to_string());
    }
    let target = std::path::Path::new(&path);
    if !target.is_absolute() {
        return Err("Save path must be absolute".to_string());
    }
    std::fs::write(target, contents).map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_text_file])
        .run(tauri::generate_context!())
        .expect("error while running Intent Scheduler");
}
