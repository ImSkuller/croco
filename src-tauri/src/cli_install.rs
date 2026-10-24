// Puts the bundled `croco` terminal app (installed as <app dir>/bin/croco) on
// the user's PATH. On Windows the NSIS installer already does this machine-
// wide (see src-tauri/windows/hooks.nsh); this module is the in-app way to do
// it on macOS/Linux (a symlink in ~/.local/bin) and per-user on Windows, and
// to show whether it's currently working. Never touches the system PATH.

use serde_json::{json, Value};
use std::path::PathBuf;
#[cfg(windows)]
use std::process::Command;
use tauri::{AppHandle, Manager};

fn bundled_cli(app: &AppHandle) -> Option<PathBuf> {
    let name = if cfg!(windows) { "croco.exe" } else { "croco" };
    let p = app.path().resource_dir().ok()?.join("bin").join(name);
    // The build.rs placeholder is a 0-byte file; only a real binary counts.
    if p.metadata().map(|m| m.len() > 0).unwrap_or(false) { Some(p) } else { None }
}

fn path_has(dir: &std::path::Path) -> bool {
    let trim = |s: &str| s.trim_end_matches(&['\\', '/'][..]).to_lowercase();
    let want = trim(&dir.to_string_lossy());
    std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).any(|e| trim(&e.to_string_lossy()) == want))
        .unwrap_or(false)
}

#[cfg(windows)]
fn windows_path_script(add: bool) -> &'static str {
    // Per-user PATH, kept as REG_EXPAND_SZ so %VARS% in it keep expanding.
    if add {
        "$d=$env:CROCO_BIN_DIR.TrimEnd([char]92); $k=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment',$true); $p=[string]$k.GetValue('Path','','DoNotExpandEnvironmentNames'); $parts=@($p -split ';' | Where-Object { $_ -and ($_.TrimEnd([char]92) -ine $d) }); $parts+=$d; $k.SetValue('Path',($parts -join ';'),[Microsoft.Win32.RegistryValueKind]::ExpandString); $k.Close(); [Environment]::SetEnvironmentVariable('CROCO_PATH_REFRESH',[guid]::NewGuid().ToString(),'User'); [Environment]::SetEnvironmentVariable('CROCO_PATH_REFRESH',$null,'User')"
    } else {
        "$d=$env:CROCO_BIN_DIR.TrimEnd([char]92); $k=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment',$true); $p=[string]$k.GetValue('Path','','DoNotExpandEnvironmentNames'); $parts=@($p -split ';' | Where-Object { $_ -and ($_.TrimEnd([char]92) -ine $d) }); $k.SetValue('Path',($parts -join ';'),[Microsoft.Win32.RegistryValueKind]::ExpandString); $k.Close(); [Environment]::SetEnvironmentVariable('CROCO_PATH_REFRESH',[guid]::NewGuid().ToString(),'User'); [Environment]::SetEnvironmentVariable('CROCO_PATH_REFRESH',$null,'User')"
    }
}

#[cfg(windows)]
fn registry_path_has(dir: &std::path::Path) -> bool {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command",
        "$d=$env:CROCO_BIN_DIR.TrimEnd([char]92); foreach($s in 'User','Machine'){ foreach($e in ([Environment]::GetEnvironmentVariable('Path',$s) -split ';')){ if($e.TrimEnd([char]92) -ieq $d){ 'yes'; exit } } }"])
        .env("CROCO_BIN_DIR", dir);
    crate::no_window(&mut cmd);
    cmd.output().map(|o| String::from_utf8_lossy(&o.stdout).contains("yes")).unwrap_or(false)
}

#[cfg(not(windows))]
fn link_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".local").join("bin").join("croco"))
}

#[tauri::command]
pub async fn cli_status(app: AppHandle) -> Result<Value, String> {
    let Some(bin) = bundled_cli(&app) else {
        return Ok(json!({ "available": false, "installed": false, "needsRestart": false, "binPath": null }));
    };
    #[cfg(windows)]
    let dir = bin.parent().map(|p| p.to_path_buf()).unwrap_or_default();

    #[cfg(windows)]
    let (installed, needs_restart) = {
        let live = path_has(&dir);
        if live { (true, false) } else { (registry_path_has(&dir), true) }
    };
    #[cfg(not(windows))]
    let (installed, needs_restart) = {
        let linked = link_path()
            .and_then(|l| std::fs::read_link(&l).ok())
            .map(|t| t == bin)
            .unwrap_or(false);
        let on_path = link_path().and_then(|l| l.parent().map(path_has)).unwrap_or(false);
        (linked, linked && !on_path)
    };

    Ok(json!({
        "available": true,
        "installed": installed,
        "needsRestart": needs_restart,
        "binPath": bin.to_string_lossy(),
    }))
}

#[tauri::command]
pub async fn cli_install(app: AppHandle) -> Result<Value, String> {
    let bin = bundled_cli(&app).ok_or("The terminal app isn't bundled in this build.")?;

    #[cfg(windows)]
    {
        let dir = bin.parent().ok_or("bad path")?.to_path_buf();
        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", windows_path_script(true)])
            .env("CROCO_BIN_DIR", &dir);
        crate::no_window(&mut cmd);
        let out = cmd.output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
    }
    #[cfg(not(windows))]
    {
        use std::os::unix::fs::symlink;
        let link = link_path().ok_or("Couldn't find your home folder.")?;
        std::fs::create_dir_all(link.parent().ok_or("bad path")?).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&link);
        symlink(&bin, &link).map_err(|e| e.to_string())?;
    }
    cli_status(app).await
}

#[tauri::command]
pub async fn cli_uninstall(app: AppHandle) -> Result<Value, String> {
    let bin = bundled_cli(&app).ok_or("The terminal app isn't bundled in this build.")?;

    #[cfg(windows)]
    {
        let dir = bin.parent().ok_or("bad path")?.to_path_buf();
        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", windows_path_script(false)])
            .env("CROCO_BIN_DIR", &dir);
        crate::no_window(&mut cmd);
        let out = cmd.output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(link) = link_path() {
            // Only remove the link if it is ours.
            if std::fs::read_link(&link).map(|t| t == bin).unwrap_or(false) {
                let _ = std::fs::remove_file(&link);
            }
        }
        let _ = &bin;
    }
    cli_status(app).await
}
