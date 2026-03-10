@echo off
setlocal EnableExtensions

cd /d "%~dp0"

echo ========================================
echo  VibeLaTeX One-Click Startup (Windows)
echo ========================================

where node >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js was not found.
  echo Install Node.js 20+ ^(24.x recommended^): https://nodejs.org/en/download
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm was not found.
  echo Reinstall Node.js and try again.
  echo.
  pause
  exit /b 1
)

set "NODE_MAJOR="
for /f %%i in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%i"
if not defined NODE_MAJOR set "NODE_MAJOR=0"
if %NODE_MAJOR% LSS 20 (
  echo [Info] Current Node.js major version is %NODE_MAJOR%. Node.js 20+ is recommended.
)

set "NEED_INSTALL=no"
for /f %%i in ('powershell -NoProfile -Command "$need = -not (Test-Path ''node_modules''); if (-not $need -and (Test-Path ''package-lock.json'')) { $need = (Get-Item ''package-lock.json'').LastWriteTimeUtc -gt (Get-Item ''node_modules'').LastWriteTimeUtc }; if ($need) { ''yes'' } else { ''no'' }"') do set "NEED_INSTALL=%%i"

if /I "%NEED_INSTALL%"=="yes" (
  echo.
  echo [1/2] Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 (
    echo [Error] Failed to install dependencies.
    echo.
    pause
    exit /b 1
  )
) else (
  echo.
  echo [1/2] Dependencies are ready. Skipping install.
)

set "PORT="
for /f %%i in ('powershell -NoProfile -Command "$used = @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()).Port; foreach ($p in 3000..3010) { if ($used -notcontains $p) { $p; break } }"') do set "PORT=%%i"

if not defined PORT (
  echo [Error] No free port was found between 3000 and 3010.
  echo.
  pause
  exit /b 1
)

echo [2/2] Starting the development server...
echo.
echo Editor: http://localhost:%PORT%
echo Admin:  http://localhost:%PORT%/admin
echo Stop:   press Ctrl + C in this window

start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:%PORT%'" >nul 2>nul

call npm run dev -- --port %PORT%
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo Server stopped with exit code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
