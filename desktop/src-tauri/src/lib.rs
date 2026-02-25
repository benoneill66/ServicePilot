use tauri::menu::{MenuBuilder, SubmenuBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&edit_menu)
                .build()?;

            app.set_menu(menu)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
