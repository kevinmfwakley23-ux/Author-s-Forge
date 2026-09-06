use serde::Serialize;

/// This flag is intentionally false until the Android native adapter owns the
/// complete normal Forge runtime on-device. CI refuses to publish a standalone
/// private-test APK while it remains false.
pub const STANDALONE_ANDROID_RUNTIME_READY: bool = false;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeOfficeDescriptor {
    pub id: &'static str,
    pub name: &'static str,
    /// False means this office is part of the shipped complete Forge rather
    /// than an optional product add-on.
    pub optional_add_on: bool,
    pub attached_by_default: bool,
    pub separate_live_brain: bool,
    pub brain_scope: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeRuntimeStatus {
    pub product: &'static str,
    pub standalone_android_runtime_ready: bool,
    pub requires_remote_forge_runtime: bool,
    pub offices: Vec<NativeOfficeDescriptor>,
}

pub fn office_descriptors() -> Vec<NativeOfficeDescriptor> {
    vec![
        NativeOfficeDescriptor {
            id: "studio",
            name: "Main Forge / Studio",
            optional_add_on: false,
            attached_by_default: true,
            separate_live_brain: true,
            brain_scope: "studio",
        },
        NativeOfficeDescriptor {
            id: "journal",
            name: "Guided Journal Office",
            optional_add_on: false,
            attached_by_default: true,
            separate_live_brain: true,
            brain_scope: "journal",
        },
        NativeOfficeDescriptor {
            id: "workbooks",
            name: "Educational Workbook Office",
            optional_add_on: false,
            attached_by_default: true,
            separate_live_brain: true,
            brain_scope: "workbooks",
        },
        NativeOfficeDescriptor {
            id: "specialized",
            name: "Specialized Creation Office",
            optional_add_on: false,
            attached_by_default: true,
            separate_live_brain: true,
            brain_scope: "specialized",
        },
        NativeOfficeDescriptor {
            id: "nft",
            name: "NFT Creation Office",
            optional_add_on: false,
            attached_by_default: true,
            separate_live_brain: true,
            brain_scope: "nft",
        },
    ]
}

#[tauri::command]
pub fn native_runtime_status() -> NativeRuntimeStatus {
    NativeRuntimeStatus {
        product: "K.I.N.G.S. Author's Forge",
        standalone_android_runtime_ready: STANDALONE_ANDROID_RUNTIME_READY,
        requires_remote_forge_runtime: !STANDALONE_ANDROID_RUNTIME_READY,
        offices: office_descriptors(),
    }
}

#[tauri::command]
pub fn native_offices() -> Vec<NativeOfficeDescriptor> {
    office_descriptors()
}
