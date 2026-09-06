mod office_runtime;
mod runtime;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Stronghold owns encrypted provider credentials. The salt lives in
            // this app's private data directory; provider secrets are never
            // placed in the public web assets or shared office configuration.
            let salt_path = app
                .path()
                .app_local_data_dir()?
                .join("forge-stronghold.salt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;
            Ok(())
        })
        .manage(office_runtime::OfficeRuntimeManager::new())
        .invoke_handler(tauri::generate_handler![
            runtime::native_runtime_status,
            runtime::native_offices,
            office_runtime::forge_native_runtime_snapshot,
            office_runtime::forge_native_set_office_enabled,
            office_runtime::forge_native_configure_provider_metadata,
            office_runtime::forge_native_record_provider_observation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running K.I.N.G.S. Author's Forge native application");
}
