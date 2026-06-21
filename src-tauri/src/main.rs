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
const MAX_EXPORT_BYTES: usize = 100 * 1024 * 1024;

#[tauri::command]
fn save_export_file(filename: String, bytes: Vec<u8>) -> Result<Vec<String>, String> {
    if bytes.len() > MAX_EXPORT_BYTES {
        return Err("File export troppo grande.".to_string());
    }

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

    if path.trim().is_empty() {
        return Err("Percorso non valido.".to_string());
    }

    let export_dir_canonical = export_dir
        .canonicalize()
        .map_err(|error| format!("Impossibile validare la cartella Download: {error}"))?;
    let requested_path = PathBuf::from(path);
    let target_path = if requested_path.is_absolute() {
        requested_path
    } else {
        export_dir_canonical.join(requested_path)
    };

    let target_canonical = target_path
        .canonicalize()
        .map_err(|_| "Percorso non valido o inesistente.".to_string())?;

    if !target_canonical.starts_with(&export_dir_canonical) {
        return Err("Posso aprire solo la cartella degli export dell'app.".to_string());
    }

    let directory = if target_canonical.is_file() {
        target_canonical
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "Percorso del file non valido.".to_string())?
    } else {
        target_canonical
    };

    if !directory.exists() {
        return Err("La cartella non esiste piu.".to_string());
    }

    open_directory(&directory)
}

#[tauri::command]
fn read_desktop_db(app: AppHandle) -> Result<Option<String>, String> {
    let db_path = desktop_db_path(&app)?;

    match fs::metadata(&db_path) {
        Ok(metadata) if metadata.len() > MAX_DESKTOP_DB_BYTES as u64 => {
            return Err("Database locale troppo grande.".to_string());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Impossibile leggere il database locale: {error}")),
    }

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

/// Removes the entire app data directory (database, temp files, etc.).
/// Called by the NSIS uninstaller on Windows and by the .deb postrm script on Linux,
/// or manually from the settings UI as a fallback for macOS/AppImage.
#[tauri::command]
fn cleanup_app_data(app: AppHandle) -> Result<String, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Impossibile trovare la cartella dati dell'app: {error}"))?;

    if !app_data_dir.exists() {
        return Ok("Nessuna cartella dati da rimuovere.".to_string());
    }

    // Remove all contents inside the app data directory
    let entries = fs::read_dir(&app_data_dir)
        .map_err(|error| format!("Impossibile leggere la cartella dati: {error}"))?;

    let mut removed: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                errors.push(format!("Errore lettura elemento: {e}"));
                continue;
            }
        };

        let path = entry.path();
        let path_str = path.to_string_lossy().into_owned();

        let result = if path.is_dir() {
            fs::remove_dir_all(&path)
        } else {
            fs::remove_file(&path)
        };

        if let Err(e) = result {
            errors.push(format!("{path_str}: {e}"));
        } else {
            removed.push(path_str);
        }
    }

    // Try to remove the now-empty directory itself
    let _ = fs::remove_dir(&app_data_dir);

    if errors.is_empty() {
        Ok(format!("Pulizia completata. {} file/cartelle rimossi.", removed.len()))
    } else {
        Err(format!(
            "Pulizia parziale. Rimossi: {}. Errori: {}",
            removed.len(),
            errors.join("; ")
        ))
    }
}

/// Opens an external URL in the user's default browser.
/// In Tauri's WebView, <a target="_blank"> does not open the system browser,
/// so this command bridges that gap.
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    // Validate that it's an http/https URL to prevent arbitrary command execution
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Solo URL http/https sono supportati.".to_string());
    }

    open_url(&url)
}

fn open_url(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Impossibile aprire il browser: {error}"))
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Impossibile aprire il browser: {error}"))
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|error| format!("Impossibile aprire il browser: {error}"))
    }
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
            cleanup_app_data,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
