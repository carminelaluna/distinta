@echo off
setlocal
cd /d "%~dp0"
title Distinta - anteprima locale

REM ============================================================
REM  Doppio click qui, e basta.
REM
REM  Serve un server perche' la pagina usa i moduli JavaScript e
REM  carica catalogo.json con fetch: aprendo il file con un doppio
REM  click il protocollo e' file:// e il browser blocca entrambi.
REM  E' una regola di sicurezza, non un difetto.
REM
REM  Per fermare il server: CTRL+C, oppure chiudi la finestra.
REM ============================================================

echo.
echo   Distinta - anteprima locale
echo   ---------------------------

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Python non trovato nel PATH. Serve solo per il server locale.
  echo.
  pause
  exit /b 1
)

echo   apro il browser su http://localhost:8183/
start "" http://localhost:8183/
echo.
echo   CTRL+C per fermare.
echo.
python -m http.server 8183
