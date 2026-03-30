use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter};

struct TerminalSession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

struct TerminalState {
    sessions: HashMap<u32, TerminalSession>,
    next_id: u32,
    shell: String,
    shell_path: String,
}

struct Terminals(Mutex<TerminalState>);

fn resolve_shell_path(shell: &str) -> String {
    std::process::Command::new(shell)
        .args(["-lic", "echo $PATH"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

#[tauri::command]
fn create_terminal(
    app: AppHandle,
    state: tauri::State<Terminals>,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let size = PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system.openpty(size).map_err(|e| e.to_string())?;

    let (shell, shell_path) = {
        let ts = state.0.lock().unwrap();
        (ts.shell.clone(), ts.shell_path.clone())
    };

    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l");

    let work_dir = cwd.unwrap_or_else(|| {
        std::env::var("HOME").unwrap_or_else(|_| "/".to_string())
    });
    cmd.cwd(&work_dir);

    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if !shell_path.is_empty() {
        cmd.env("PATH", &shell_path);
    }

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let id = {
        let mut ts = state.0.lock().unwrap();
        let id = ts.next_id;
        ts.next_id += 1;
        ts.sessions.insert(id, TerminalSession { master: pair.master, writer });
        id
    };

    // Background thread: read PTY output and emit Tauri events
    let output_event = format!("terminal-output-{}", id);
    let exit_event = format!("terminal-exit-{}", id);
    let app_handle = app.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(&output_event, &data);
                }
                Err(_) => break,
            }
        }
        let _ = app_handle.emit(&exit_event, ());
    });

    // Background thread: reap child process to prevent zombies
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(id)
}

#[tauri::command]
fn write_terminal(state: tauri::State<Terminals>, id: u32, data: String) -> Result<(), String> {
    let mut ts = state.0.lock().unwrap();
    let session = ts.sessions.get_mut(&id).ok_or("Terminal not found")?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn resize_terminal(
    state: tauri::State<Terminals>,
    id: u32,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let ts = state.0.lock().unwrap();
    let session = ts.sessions.get(&id).ok_or("Terminal not found")?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn close_terminal(state: tauri::State<Terminals>, id: u32) -> Result<(), String> {
    let mut ts = state.0.lock().unwrap();
    // Dropping the session closes the master PTY fd → shell receives SIGHUP
    ts.sessions.remove(&id);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let shell_path = resolve_shell_path(&shell);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(Terminals(Mutex::new(TerminalState {
            sessions: HashMap::new(),
            next_id: 1,
            shell,
            shell_path,
        })))
        .invoke_handler(tauri::generate_handler![
            create_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
        ])
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

            let menu = MenuBuilder::new(app).item(&edit_menu).build()?;

            app.set_menu(menu)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
