@echo off
setlocal enabledelayedexpansion

title MotionByDk AEworkflow - Windows Installer
color 06

echo =========================================================================
echo                  MOTIONBYDK AEWORKFLOW INSTALLER (WINDOWS)
echo =========================================================================
echo.

:: 1. Enable PlayerDebugMode across Adobe CSXS versions
echo [1/3] Enabling PlayerDebugMode in Windows Registry...
for %%v in (9 10 11 12 13 14 15 16 17) do (
    reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [+] Enabled CSXS.%%v PlayerDebugMode
    )
)
echo.

:: 2. Target Directory Setup
set "TARGET_DIR=%APPDATA%\Adobe\CEP\extensions\MotionByDk AE Workflow"
echo [2/3] Preparing Adobe CEP extensions directory...
echo   Target: "%TARGET_DIR%"

if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%" 2>nul
)

:: 3. Copy ONLY core extension folders and files
echo.
echo [3/3] Installing core extension files (CSXS, client, host, .debug)...
set "SOURCE_DIR=%~dp0"

:: Clean any previously copied non-extension files if they exist
del /F /Q "%TARGET_DIR%\*.md" "%TARGET_DIR%\*.bat" "%TARGET_DIR%\*.sh" "%TARGET_DIR%\.DS_Store" 2>nul

:: Copy CSXS folder
if not exist "%TARGET_DIR%\CSXS" mkdir "%TARGET_DIR%\CSXS" 2>nul
xcopy "%SOURCE_DIR%CSXS" "%TARGET_DIR%\CSXS\" /E /I /Y /Q >nul 2>&1
echo   [+] Copied CSXS directory

:: Copy client folder
if not exist "%TARGET_DIR%\client" mkdir "%TARGET_DIR%\client" 2>nul
xcopy "%SOURCE_DIR%client" "%TARGET_DIR%\client\" /E /I /Y /Q >nul 2>&1
echo   [+] Copied client directory

:: Copy host folder
if not exist "%TARGET_DIR%\host" mkdir "%TARGET_DIR%\host" 2>nul
xcopy "%SOURCE_DIR%host" "%TARGET_DIR%\host\" /E /I /Y /Q >nul 2>&1
echo   [+] Copied host directory

:: Copy .debug if present
if exist "%SOURCE_DIR%.debug" (
    copy /Y "%SOURCE_DIR%.debug" "%TARGET_DIR%\.debug" >nul 2>&1
    echo   [+] Copied .debug file
)

:: 4. Install Liquid Glass Plugin (if extra_plugins\Windows exists)
if exist "%SOURCE_DIR%extra_plugins\Windows\ToolsForMotion\LiquidGlass.aex" (
    echo.
    echo [4/4] Installing Liquid Glass native plugin...
    for /d %%D in ("%ProgramFiles%\Adobe\Adobe After Effects *") do (
        if exist "%%D\Support Files\Plug-ins" (
            echo   [+] Installing to: "%%D\Support Files\Plug-ins\ToolsForMotion"
            if not exist "%%D\Support Files\Plug-ins\ToolsForMotion" mkdir "%%D\Support Files\Plug-ins\ToolsForMotion" 2>nul
            copy /Y "%SOURCE_DIR%extra_plugins\Windows\ToolsForMotion\LiquidGlass.aex" "%%D\Support Files\Plug-ins\ToolsForMotion\LiquidGlass.aex" >nul 2>&1
        )
    )
)

echo.
echo =========================================================================
echo                        INSTALLATION COMPLETED!
echo =========================================================================
echo.
echo Installed cleanly into Adobe CEP extensions folder.
echo (Only main extension folders/files installed; docs and scripts excluded).
echo.
echo IMPORTANT NEXT STEPS:
echo   1. Open Adobe After Effects.
echo   2. Go to: Edit ^> Preferences ^> Scripting ^& Expressions
echo   3. CHECK: [X] "Allow Scripts to Write Files and Access Network"
echo   4. Go to: Window ^> Extensions ^> MotionByDk AEworkflow
echo.
echo For any help or queries: motionbydk@gmail.com
echo Enjoy your motion design workflow!
echo =========================================================================
echo.
pause
