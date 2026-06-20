!macro NSIS_HOOK_PREUNINSTALL
  ; Remove app data directory on uninstall (Windows)
  ; The app identifier is "com.the.club" — Tauri stores data under %APPDATA%\com.the.club
  ReadEnvStr $0 "APPDATA"
  IfFileExists "$0\com.the.club\*.*" 0 skip_data_cleanup
    RMDir /r "$0\com.the.club"
  skip_data_cleanup:

  ; Also check LOCALAPPDATA (some Tauri versions use this)
  ReadEnvStr $1 "LOCALAPPDATA"
  IfFileExists "$1\com.the.club\*.*" 0 skip_localappdata_cleanup
    RMDir /r "$1\com.the.club"
  skip_localappdata_cleanup:
!macroend