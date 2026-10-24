use std::{env, fs, path::Path};

fn main() {
    // The terminal app (cli-rs/) is bundled as a resource: tauri.conf.json
    // lists `cli-bin/*`, and tauri-build refuses to proceed if that matches
    // nothing. scripts/build-cli.mjs replaces this placeholder with the real
    // binary during `tauri build`; plain `cargo check` / `tauri dev` just
    // need the path to exist.
    let name = if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") { "croco.exe" } else { "croco" };
    let dir = Path::new("cli-bin");
    let _ = fs::create_dir_all(dir);
    let file = dir.join(name);
    if !file.exists() {
        let _ = fs::write(&file, b"");
    }
    println!("cargo:rerun-if-changed=cli-bin");

    tauri_build::build()
}
