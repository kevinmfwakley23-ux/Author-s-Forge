mod office_runtime;
mod runtime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
