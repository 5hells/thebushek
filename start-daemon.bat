@echo off
REM Schedule Exporter Daemon - Runs continuously with periodic exports
REM This script runs the daemon that exports schedule at regular intervals

cd /d "%~dp0"

echo Starting schedule export daemon...
echo Press Ctrl+C to stop

bun run schedule-daemon.ts
