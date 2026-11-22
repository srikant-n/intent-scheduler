use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:tracker.db";

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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running Intent Scheduler");
}
