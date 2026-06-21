!macro NSIS_HOOK_PREUNINSTALL
  ; Data cleanup is handled via the in-app "Rimuovi dati locali" button
  ; in Settings, which calls the Tauri cleanup_app_data command.
  ; This avoids NSIS scripting complexity and build errors.
  ; During updates, Tauri runs the uninstaller silently — data is always preserved.
!macroend