#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager};

const DESKTOP_DB_FILENAME: &str = "desktop-db.json";
const DESKTOP_DB_TMP_FILENAME: &str = "desktop-db.json.tmp";
const MAX_DESKTOP_DB_BYTES: usize = 50 * 1024 * 1024;

#[tauri::command]
fn save_export_file(filename: String, bytes: Vec<u8>) -> Result<Vec<String>, String> {
    let export_dir = downloads_dir().ok_or_else(|| "Impossibile trovare la cartella Download.".to_string())?;
    fs::create_dir_all(&export_dir)
        .map_err(|error| format!("Impossibile creare la cartella Download: {error}"))?;

    let file_path = write_unique_export_file(&export_dir, &sanitize_filename(&filename), &bytes)?;

    Ok(vec![
        file_path.to_string_lossy().into_owned(),
        export_dir.to_string_lossy().into_owned(),
    ])
}

#[tauri::command]
fn open_export_directory(path: String) -> Result<(), String> {
    let export_dir = downloads_dir().ok_or_else(|| "Impossibile trovare la cartella Download.".to_string())?;
    let target = PathBuf::from(path);
    let directory = if target.is_file() {
        target
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "Percorso del file non valido.".to_string())?
    } else {
        target
    };

    if !directory.exists() {
        return Err("La cartella non esiste piu.".to_string());
    }

    let export_dir = export_dir
        .canonicalize()
        .map_err(|error| format!("Impossibile validare la cartella Download: {error}"))?;
    let directory = directory
        .canonicalize()
        .map_err(|error| format!("Impossibile validare la cartella export: {error}"))?;

    if !directory.starts_with(&export_dir) {
        return Err("Posso aprire solo la cartella degli export dell'app.".to_string());
    }

    open_directory(&directory)
}

#[tauri::command]
fn read_desktop_db(app: AppHandle) -> Result<Option<String>, String> {
    let db_path = desktop_db_path(&app)?;

    match fs::read_to_string(&db_path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Impossibile leggere il database locale: {error}")),
    }
}

#[tauri::command]
fn write_desktop_db(app: AppHandle, contents: String) -> Result<(), String> {
    if contents.len() > MAX_DESKTOP_DB_BYTES {
        return Err("Database locale troppo grande.".to_string());
    }

    let db_path = desktop_db_path(&app)?;
    let tmp_path = db_path.with_file_name(DESKTOP_DB_TMP_FILENAME);
    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&tmp_path)
        .map_err(|error| format!("Impossibile preparare il database locale: {error}"))?;

    file.write_all(contents.as_bytes())
        .map_err(|error| format!("Impossibile scrivere il database locale: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Impossibile completare il salvataggio del database locale: {error}"))?;
    drop(file);

    if let Err(rename_error) = fs::rename(&tmp_path, &db_path) {
        if db_path.exists() {
            fs::remove_file(&db_path)
                .map_err(|error| format!("Impossibile aggiornare il database locale: {error}"))?;
        }
        fs::rename(&tmp_path, &db_path)
            .map_err(|error| format!("Impossibile aggiornare il database locale: {rename_error}; {error}"))?;
    }

    Ok(())
}

#[tauri::command]
fn reset_desktop_db(app: AppHandle) -> Result<(), String> {
    let db_path = desktop_db_path(&app)?;
    let tmp_path = db_path.with_file_name(DESKTOP_DB_TMP_FILENAME);

    remove_file_if_exists(&db_path)?;
    remove_file_if_exists(&tmp_path)?;

    Ok(())
}

fn sanitize_filename(filename: &str) -> String {
    let sanitized = filename
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            c if c.is_control() => '-',
            c => c,
        })
        .collect::<String>();
    let trimmed = sanitized.trim_matches([' ', '.']).to_string();

    if trimmed.is_empty() {
        "export".to_string()
    } else {
        trimmed
    }
}

fn write_unique_export_file(export_dir: &Path, filename: &str, bytes: &[u8]) -> Result<PathBuf, String> {
    for attempt in 0..1000 {
        let file_path = export_dir.join(export_filename_variant(filename, attempt));
        let mut file = match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&file_path)
        {
            Ok(file) => file,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Impossibile salvare il file: {error}")),
        };

        file.write_all(bytes)
            .map_err(|error| format!("Impossibile scrivere il file: {error}"))?;
        return Ok(file_path);
    }

    Err("Impossibile trovare un nome libero per il file export.".to_string())
}

fn export_filename_variant(filename: &str, attempt: usize) -> String {
    if attempt == 0 {
        return filename.to_string();
    }

    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("export");
    let extension = path.extension().and_then(|value| value.to_str());

    match extension {
        Some(extension) if !extension.is_empty() => format!("{stem} ({attempt}).{extension}"),
        _ => format!("{stem} ({attempt})"),
    }
}

fn downloads_dir() -> Option<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        if let Some(path) = linux_xdg_download_dir() {
            return Some(path);
        }
    }

    #[cfg(target_os = "windows")]
    {
        return std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .map(|path| path.join("Downloads"));
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|path| path.join("Downloads"))
    }
}

fn desktop_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Impossibile trovare la cartella dati dell'app: {error}"))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|error| format!("Impossibile creare la cartella dati dell'app: {error}"))?;

    Ok(app_data_dir.join(DESKTOP_DB_FILENAME))
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Impossibile cancellare il database locale: {error}")),
    }
}

#[cfg(target_os = "linux")]
fn linux_xdg_download_dir() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let config_home = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(&home).join(".config"));
    let user_dirs = fs::read_to_string(config_home.join("user-dirs.dirs")).ok()?;

    user_dirs.lines().find_map(|line| {
        let value = line.strip_prefix("XDG_DOWNLOAD_DIR=")?;
        let value = value.trim().trim_matches('"').replace("$HOME", &home);
        Some(PathBuf::from(value))
    })
}

fn open_directory(directory: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer");
        command.arg(directory);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(directory);
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(directory);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Impossibile aprire la cartella: {error}"))
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_export_file,
            open_export_directory,
            read_desktop_db,
            write_desktop_db,
            reset_desktop_db,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
