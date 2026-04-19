; sansxel silent installer
;
; Custom NSIS template referenced by tauri.conf.json
; (`bundle.windows.nsis.template`). Tauri renders this file through
; Handlebars before running makensis, which is why a few values
; ({{main_binary_name}}, {{install_dir}}, {{bundle_id}}, …) are
; substituted at bundle time.
;
; Goals (v0.1.8):
;   - No NSIS UI at all. SilentInstall enforces it; we also skip the
;     MUI macros that would otherwise pop a wizard.
;   - Install per-user under %LOCALAPPDATA%\Programs\sansxel — no UAC.
;   - Register the sansxel:// deep link scheme.
;   - Drop a Start menu + Desktop shortcut.
;   - Auto-launch sansxel.exe at the end of install. The Tauri splash
;     window then takes over the "you've installed sansxel" UX.
;
; Tauri still provides the standard plumbing variables; we keep them
; (UninstallString, DisplayName, …) so Add/Remove Programs and the
; sansxel updater both keep working.

Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2

SetCompressor /SOLID "lzma"

!include FileFunc.nsh
!include x64.nsh
!include WordFunc.nsh
!include LogicLib.nsh
!include "utils.nsh"
!include "FileAssociation.nsh"
!include "Win\COM.nsh"
!include "Win\Propkey.nsh"
!include "StrFunc.nsh"
${StrCase}
${StrLoc}

!define MANUFACTURER "{{manufacturer}}"
!define PRODUCTNAME "{{product_name}}"
!define VERSION "{{version}}"
!define VERSIONWITHBUILD "{{version_with_build}}"
!define MAINBINARYNAME "{{main_binary_name}}"
!define MAINBINARYSRCPATH "{{main_binary_path}}"
!define BUNDLEID "{{bundle_id}}"
!define COPYRIGHT "{{copyright}}"
!define OUTFILE "{{out_file}}"
!define ARCH "{{arch}}"
!define INSTALLERICON "{{installer_icon}}"
!define ESTIMATEDSIZE "{{estimated_size}}"
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}"
!define MANUKEY "Software\${MANUFACTURER}"
!define MANUPRODUCTKEY "${MANUKEY}\${PRODUCTNAME}"

Var UpdateMode
Var OldMainBinaryName

Name "${PRODUCTNAME}"
BrandingText "${COPYRIGHT}"
OutFile "${OUTFILE}"

; ---- Silent install ---------------------------------------------------------
; Force the installer into silent mode regardless of whether /S was passed
; on the command line. This is what kills the wizard.
SilentInstall silent
SilentUnInstall silent
RequestExecutionLevel user

; Install per-user under %LOCALAPPDATA%\Programs\sansxel — no UAC prompt
; and lets us write shortcuts + registry under HKCU.
InstallDir "$LOCALAPPDATA\Programs\${PRODUCTNAME}"

VIProductVersion "${VERSIONWITHBUILD}"
VIAddVersionKey "ProductName" "${PRODUCTNAME}"
VIAddVersionKey "FileDescription" "${PRODUCTNAME}"
VIAddVersionKey "LegalCopyright" "${COPYRIGHT}"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"

!if "${INSTALLERICON}" != ""
  Icon "${INSTALLERICON}"
  UninstallIcon "${INSTALLERICON}"
!endif

Function .onInit
  ; Updater passes /UPDATE so we can keep shortcut behaviour stable.
  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}

  SetShellVarContext current

  ; If a previous install lives elsewhere, preserve that location so
  ; updates don't fork the install across two directories.
  ReadRegStr $4 HKCU "${MANUPRODUCTKEY}" ""
  ${If} $4 != ""
    StrCpy $INSTDIR $4
  ${EndIf}
FunctionEnd

Section Install
  SetOutPath $INSTDIR

  !ifmacrodef NSIS_HOOK_PREINSTALL
    !insertmacro NSIS_HOOK_PREINSTALL
  !endif

  ; If sansxel is currently running, ask it to exit before overwriting.
  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"

  ; Main executable
  File "${MAINBINARYSRCPATH}"

  ; ---- Deep link: sansxel:// ------------------------------------------------
  WriteRegStr HKCU "Software\Classes\sansxel" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\sansxel" "" "URL:${BUNDLEID} protocol"
  WriteRegStr HKCU "Software\Classes\sansxel\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr HKCU "Software\Classes\sansxel\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""

  ; Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; Remember where we installed so the next run/upgrade finds us.
  WriteRegStr HKCU "${MANUPRODUCTKEY}" "" $INSTDIR

  ; If the binary name changed across versions, drop the stale exe.
  ReadRegStr $OldMainBinaryName HKCU "${UNINSTKEY}" "MainBinaryName"
  ${If} $OldMainBinaryName != ""
  ${AndIf} $OldMainBinaryName != "${MAINBINARYNAME}.exe"
    Delete "$INSTDIR\$OldMainBinaryName"
  ${EndIf}
  WriteRegStr HKCU "${UNINSTKEY}" "MainBinaryName" "${MAINBINARYNAME}.exe"

  ; Add/Remove Programs entry
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${PRODUCTNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\""
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "${MANUFACTURER}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$\"$INSTDIR$\""
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" "1"
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" "1"

  ${GetSize} "$INSTDIR" "/M=uninstall.exe /S=0K /G=0" $0 $1 $2
  IntOp $0 $0 + ${ESTIMATEDSIZE}
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"

  ; ---- Shortcuts ------------------------------------------------------------
  ${If} $UpdateMode <> 1
    CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"

    CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTINSTALL
    !insertmacro NSIS_HOOK_POSTINSTALL
  !endif
SectionEnd

Function .onInstSuccess
  ; Splash takes over from here. Skip auto-launch on /UPDATE because
  ; the updater plugin restarts the app itself.
  ${If} $UpdateMode <> 1
    nsis_tauri_utils::RunAsUser "$INSTDIR\${MAINBINARYNAME}.exe" ""
  ${EndIf}
FunctionEnd

; -----------------------------------------------------------------------------
; Uninstaller
; -----------------------------------------------------------------------------
Function un.onInit
  SetShellVarContext current

  ${GetOptions} $CMDLINE "/UPDATE" $UpdateMode
  ${IfNot} ${Errors}
    StrCpy $UpdateMode 1
  ${EndIf}
FunctionEnd

Section Uninstall
  !ifmacrodef NSIS_HOOK_PREUNINSTALL
    !insertmacro NSIS_HOOK_PREUNINSTALL
  !endif

  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"

  Delete "$INSTDIR\${MAINBINARYNAME}.exe"

  ; Drop the deep link only if it still points at our binary.
  ReadRegStr $R7 HKCU "Software\Classes\sansxel\shell\open\command" ""
  ${If} $R7 == "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
    DeleteRegKey HKCU "Software\Classes\sansxel"
  ${EndIf}

  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"

  ${If} $UpdateMode <> 1
    !insertmacro DeleteAppUserModelId

    !insertmacro IsShortcutTarget "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk"
      Delete "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    ${EndIf}

    !insertmacro IsShortcutTarget "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
    Pop $0
    ${If} $0 = 1
      !insertmacro UnpinShortcut "$DESKTOP\${PRODUCTNAME}.lnk"
      Delete "$DESKTOP\${PRODUCTNAME}.lnk"
    ${EndIf}
  ${EndIf}

  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "${MANUPRODUCTKEY}"
  DeleteRegKey /ifempty HKCU "${MANUKEY}"

  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
  ${EndIf}

  !ifmacrodef NSIS_HOOK_POSTUNINSTALL
    !insertmacro NSIS_HOOK_POSTUNINSTALL
  !endif
SectionEnd
