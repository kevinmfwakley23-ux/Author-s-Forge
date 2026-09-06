mod runtime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            runtime::native_runtime_status,
            runtime::native_offices,
        ])
        .run(tauri::generate_context!())
        .expect("error while running K.I.N.G.S. Author's Forge native application");
}
