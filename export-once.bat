@echo off
REM Schedule Exporter - Run Once
REM This script exports the current schedule to schedule.json

cd /d "%~dp0"

echo Starting schedule export...
bun run export-schedule.ts

if %ERRORLEVEL% NEQ 0 (
    echo Export failed with error code %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo Export completed successfully
