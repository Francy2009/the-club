!macro NSIS_HOOK_PREUNINSTALL
  ; Skip data cleanup during silent updates (Tauri runs the uninstaller
  ; silently with /S /UPDATE before installing the new version).
  ; Only remove app data on a real, user-initiated uninstall.
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/UPDATE" $R1
  IfErrors 0 check_silent
  Goto skip_all_cleanup

  check_silent:
  ClearErrors
  ${GetOptions} $R0 "/S" $R1
  IfErrors 0 skip_all_cleanup

  ; Real uninstall — remove app data
  ReadEnvStr $0 "APPDATA"
  IfFileExists "$0\com.the.club\*.*" 0 skip_data_cleanup
    RMDir /r "$0\com.the.club"
  skip_data_cleanup:

  ReadEnvStr $1 "LOCALAPPDATA"
  IfFileExists "$1\com.the.club\*.*" 0 skip_localappdata_cleanup
    RMDir /r "$1\com.the.club"
  skip_localappdata_cleanup:

  skip_all_cleanup:
!macroend