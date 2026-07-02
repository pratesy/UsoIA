// Evita abrir um console extra no Windows em modo release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    usoai_lib::run()
}
