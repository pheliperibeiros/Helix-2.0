use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HlxFilePayload {
    pub path: String,
    pub name: String,
    pub content: String,
}

/// Checks if the application was launched by double-clicking a `.hlx` document in the OS.
#[tauri::command]
fn get_launch_hlx_file() -> Option<HlxFilePayload> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    for arg in args {
        if arg.starts_with('-') {
            continue;
        }
        let path = PathBuf::from(&arg);
        let is_hlx = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("hlx") || ext.eq_ignore_ascii_case("json"))
            .unwrap_or(false);

        if is_hlx && path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                let name = path
                    .file_stem()
                    .and_then(|n| n.to_str())
                    .unwrap_or("projeto")
                    .to_string();
                return Some(HlxFilePayload {
                    path: path.to_string_lossy().to_string(),
                    name,
                    content,
                });
            }
        }
    }
    None
}

/// Opens a native OS file dialog filtered to `.hlx` documents and reads the selected file.
#[tauri::command]
fn pick_open_hlx_file() -> Result<Option<HlxFilePayload>, String> {
    let file = rfd::FileDialog::new()
        .set_title("Abrir Documento Hélix (.hlx)")
        .add_filter("Documento Hélix (.hlx)", &["hlx"])
        .add_filter("JSON (.json)", &["json"])
        .pick_file();

    if let Some(path) = file {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("Erro ao ler arquivo .hlx: {}", e))?;
        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("projeto")
            .to_string();
        Ok(Some(HlxFilePayload {
            path: path.to_string_lossy().to_string(),
            name,
            content,
        }))
    } else {
        Ok(None)
    }
}

/// Opens a native OS Save dialog for `.hlx` documents and writes the project content to disk.
#[tauri::command]
fn pick_save_hlx_file(default_name: String, content: String) -> Result<Option<HlxFilePayload>, String> {
    let clean_name = if default_name.to_lowercase().ends_with(".hlx") {
        default_name
    } else {
        format!("{}.hlx", default_name)
    };

    let file = rfd::FileDialog::new()
        .set_title("Salvar Documento Hélix (.hlx)")
        .set_file_name(&clean_name)
        .add_filter("Documento Hélix (.hlx)", &["hlx"])
        .save_file();

    if let Some(mut path) = file {
        if path.extension().is_none() {
            path.set_extension("hlx");
        }
        fs::write(&path, &content)
            .map_err(|e| format!("Erro ao salvar arquivo .hlx: {}", e))?;
        let name = path
            .file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("projeto")
            .to_string();
        Ok(Some(HlxFilePayload {
            path: path.to_string_lossy().to_string(),
            name,
            content,
        }))
    } else {
        Ok(None)
    }
}

/// Saves directly to an existing `.hlx` path on disk.
#[tauri::command]
fn save_hlx_to_path(path: String, content: String) -> Result<HlxFilePayload, String> {
    let mut path_buf = PathBuf::from(&path);
    if path_buf.extension().is_none() {
        path_buf.set_extension("hlx");
    }
    fs::write(&path_buf, &content)
        .map_err(|e| format!("Erro ao salvar arquivo .hlx: {}", e))?;
    let name = path_buf
        .file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("projeto")
        .to_string();
    Ok(HlxFilePayload {
        path: path_buf.to_string_lossy().to_string(),
        name,
        content,
    })
}

/// Opens a native OS Save dialog to export an image (PNG, JPEG, SVG) from the canvas.
#[tauri::command]
fn pick_save_export_image(default_name: String, format: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
    let ext = match format.to_lowercase().as_str() {
        "jpeg" | "jpg" => "jpg",
        "svg" => "svg",
        _ => "png",
    };
    let clean_name = if default_name.to_lowercase().ends_with(&format!(".{}", ext)) {
        default_name
    } else {
        format!("{}.{}", default_name, ext)
    };

    let file = rfd::FileDialog::new()
        .set_title("Exportar Imagem do Grafo")
        .set_file_name(&clean_name)
        .add_filter(&format!("Imagem {}", ext.to_uppercase()), &[ext])
        .save_file();

    if let Some(path) = file {
        fs::write(&path, &bytes)
            .map_err(|e| format!("Erro ao exportar imagem: {}", e))?;
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_launch_hlx_file,
            pick_open_hlx_file,
            pick_save_hlx_file,
            save_hlx_to_path,
            pick_save_export_image
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar o aplicativo desktop Tauri Hélix");
}
