; ==============================================================================
; Open Wispr Custom NSIS Installer Script
; Professional Multi-OS Setup Installer for Windows 11 & Windows 10
; ==============================================================================

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; General Configuration
Name "Open Wispr"
OutFile "..\release\${OUT_FILENAME}"
InstallDir "$LOCALAPPDATA\Programs\Open Wispr"
InstallDirRegKey HKCU "Software\Open Wispr" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma

; Version Info
VIProductVersion "2.0.0.0"
VIAddVersionKey "ProductName" "Open Wispr"
VIAddVersionKey "CompanyName" "Open Wispr Community"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 Open Wispr Community. MIT License."
VIAddVersionKey "FileDescription" "Open Wispr Setup Installer"
VIAddVersionKey "FileVersion" "2.0.0.0"
VIAddVersionKey "ProductVersion" "2.0.0.0"

; UI Customization
!define MUI_ICON "..\assets\icon.ico"
!define MUI_UNICON "..\assets\icon.ico"
!define MUI_ABORTWARNING
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT

; Welcome Page
!define MUI_WELCOMEPAGE_TITLE "Welcome to Open Wispr Setup"
!define MUI_WELCOMEPAGE_TEXT "Open Wispr is a free, privacy-first AI voice dictation desktop companion.$\r$\n$\r$\nFeatures:$\r$\n* Universal Push-to-Talk (Hold Caps Lock in any app)$\r$\n* Instant Caret Auto-Paste$\r$\n* High-Accuracy Speech Recognition with Noise Suppression$\r$\n* Multi-Language & Hinglish Support$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME

; Directory Selection Page
!insertmacro MUI_PAGE_DIRECTORY

; Installation Progress Page
!insertmacro MUI_PAGE_INSTFILES

; Finish Page with Run Checkbox
!define MUI_FINISHPAGE_RUN "$INSTDIR\Open Wispr.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Open Wispr now"
!insertmacro MUI_PAGE_FINISH

; Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; ==============================================================================
; Installer Section
; ==============================================================================
Section "Open Wispr Application" SecMain
    SetOutPath "$INSTDIR"
    
    ; Copy all unpacked application files
    File /r "..\release\win-unpacked\*.*"

    ; Store installation folder in registry
    WriteRegStr HKCU "Software\Open Wispr" "InstallDir" "$INSTDIR"

    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall Open Wispr.exe"

    ; Create Start Menu Shortcuts
    CreateDirectory "$SMPROGRAMS\Open Wispr"
    CreateShortcut "$SMPROGRAMS\Open Wispr\Open Wispr.lnk" "$INSTDIR\Open Wispr.exe" "" "$INSTDIR\Open Wispr.exe" 0
    CreateShortcut "$SMPROGRAMS\Open Wispr\Uninstall Open Wispr.lnk" "$INSTDIR\Uninstall Open Wispr.exe" "" "$INSTDIR\Uninstall Open Wispr.exe" 0

    ; Create Desktop Shortcut
    CreateShortcut "$DESKTOP\Open Wispr.lnk" "$INSTDIR\Open Wispr.exe" "" "$INSTDIR\Open Wispr.exe" 0

    ; Windows Add/Remove Programs Registry Entries
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "DisplayName" "Open Wispr 2.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "DisplayVersion" "2.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "Publisher" "Open Wispr Community"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "DisplayIcon" "$INSTDIR\Open Wispr.exe,0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "UninstallString" '"$INSTDIR\Uninstall Open Wispr.exe"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "QuietUninstallString" '"$INSTDIR\Uninstall Open Wispr.exe" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "NoRepair" 1

    ; Estimate Size in KB for Add/Remove Programs
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr" "EstimatedSize" "$0"
SectionEnd

; ==============================================================================
; Uninstaller Section
; ==============================================================================
Section "Uninstall"
    ; Terminate running instances before uninstallation
    DetailPrint "Closing running Open Wispr processes..."
    ExecWait 'taskkill /F /IM "Open Wispr.exe" /T'
    ExecWait 'taskkill /F /IM "FlowHelper.exe" /T'

    ; Remove Shortcuts
    Delete "$DESKTOP\Open Wispr.lnk"
    Delete "$SMPROGRAMS\Open Wispr\Open Wispr.lnk"
    Delete "$SMPROGRAMS\Open Wispr\Uninstall Open Wispr.lnk"
    RMDir "$SMPROGRAMS\Open Wispr"

    ; Remove Add/Remove Programs Registry Keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Open Wispr"
    DeleteRegKey HKCU "Software\Open Wispr"

    ; Remove Installed Files and Directory
    RMDir /r "$INSTDIR"
SectionEnd
