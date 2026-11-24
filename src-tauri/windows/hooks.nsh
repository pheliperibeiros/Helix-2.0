; NSIS Custom Hooks for Hélix (.hlx File Association & Document Icon)
; Ensures Windows Explorer displays docicon.ico for .hlx files and opens them with Hélix.exe

!macro NSIS_HOOK_POSTINSTALL
  ; Register .hlx extension to Helix.Document ProgID
  WriteRegStr SHCTX "Software\Classes\.hlx" "" "Helix.Document"
  WriteRegStr SHCTX "Software\Classes\.hlx" "Content Type" "application/x-helix-project"

  ; Register Helix.Document ProgID description and DefaultIcon (docicon.ico)
  WriteRegStr SHCTX "Software\Classes\Helix.Document" "" "Documento de Grafo Hélix (.hlx)"
  WriteRegStr SHCTX "Software\Classes\Helix.Document\DefaultIcon" "" "$INSTDIR\icons\docicon.ico,0"

  ; Fallback if resources are placed directly in $INSTDIR
  IfFileExists "$INSTDIR\docicon.ico" 0 +2
    WriteRegStr SHCTX "Software\Classes\Helix.Document\DefaultIcon" "" "$INSTDIR\docicon.ico,0"

  ; Register open command to pass the .hlx file path to the Hélix executable
  WriteRegStr SHCTX "Software\Classes\Helix.Document\shell" "" "open"
  WriteRegStr SHCTX "Software\Classes\Helix.Document\shell\open" "" "Abrir no Hélix"
  WriteRegStr SHCTX "Software\Classes\Helix.Document\shell\open\command" "" '"$INSTDIR\${MAINBINARYNAME}.exe" "%1"'

  ; Notify Windows Shell to refresh file association icons immediately
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\.hlx"
  DeleteRegKey SHCTX "Software\Classes\Helix.Document"
  System::Call 'Shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
