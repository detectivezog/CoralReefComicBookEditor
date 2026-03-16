@echo off
setlocal

:: ===========================================================
:: CONFIGURATION (Key-Value Pairs)
:: ===========================================================
set "targetBrowser=C:\Program Files\Mozilla Firefox\firefox.exe"
set "defaultFile=editor.html"
:: ===========================================================

:: 1. Check if an argument (%1) exists (Drag and Drop scenario)
if "%~1"=="" goto :NoArgument

:: 2. Drag and Drop Logic
set "ext=%~x1"
if /I "%ext%"==".html" (
    echo [VALID] Opening dropped file: %~nx1
    start "" "%targetBrowser%" "%~1"
    exit /b
) else (
    echo [ACCESS DENIED] Detective, only .html files are accepted.
    echo Detected: %ext%
    pause
    exit /b
)

:NoArgument
:: 3. Double-Click Logic (Open the default file)
:: %~dp0 ensures it looks in the same directory as this script
if exist "%~dp0%defaultFile%" (
    echo [DEFAULT] Opening %defaultFile% from local directory...
    start "" "%targetBrowser%" "%~dp0%defaultFile%"
    exit /b
) else (
    echo [ERROR] Default file not found: %defaultFile%
    echo Please ensure %defaultFile% is in this folder: %~dp0
    pause
    exit /b
)