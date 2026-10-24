; Installer hooks (bundle.windows.nsis.installerHooks): put <install dir>\bin on
; the machine PATH so typing `croco` in any cmd / PowerShell / Windows
; Terminal window starts Croco's terminal app, and take it off again on
; uninstall. The registry value is rewritten as REG_EXPAND_SZ (never
; flattened to REG_SZ, which would break %SystemRoot% entries) and the edit
; is idempotent, so reinstalls and auto-updates don't pile up duplicates.

!macro NSIS_HOOK_POSTINSTALL
  System::Call 'Kernel32::SetEnvironmentVariable(t "CROCO_BIN_DIR", t "$INSTDIR\bin")i.r0'
  nsExec::ExecToLog `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d=$$env:CROCO_BIN_DIR.TrimEnd([char]92); $$k=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Session Manager\Environment',$$true); $$p=[string]$$k.GetValue('Path','','DoNotExpandEnvironmentNames'); $$parts=@($$p -split ';' | Where-Object { $$_ -and ($$_.TrimEnd([char]92) -ine $$d) }); $$parts+=$$d; $$k.SetValue('Path',($$parts -join ';'),[Microsoft.Win32.RegistryValueKind]::ExpandString); $$k.Close()"`
  Pop $0
  SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  System::Call 'Kernel32::SetEnvironmentVariable(t "CROCO_BIN_DIR", t "$INSTDIR\bin")i.r0'
  nsExec::ExecToLog `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$$d=$$env:CROCO_BIN_DIR.TrimEnd([char]92); $$k=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Control\Session Manager\Environment',$$true); $$p=[string]$$k.GetValue('Path','','DoNotExpandEnvironmentNames'); $$parts=@($$p -split ';' | Where-Object { $$_ -and ($$_.TrimEnd([char]92) -ine $$d) }); $$k.SetValue('Path',($$parts -join ';'),[Microsoft.Win32.RegistryValueKind]::ExpandString); $$k.Close()"`
  Pop $0
  SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
!macroend
