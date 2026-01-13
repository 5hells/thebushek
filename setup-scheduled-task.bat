@echo off
REM Setup Windows Task Scheduler for Daily Schedule Export
REM This script creates a scheduled task that runs export-once.bat daily at 6:00 AM

echo ========================================
echo PowerSchool Schedule Export Task Setup
echo ========================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: This script requires administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo Creating scheduled task...
schtasks /Create /XML "%~dp0schedule-task.xml" /TN "PowerSchool Schedule Export" /F

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to create scheduled task.
    echo Make sure the XML file exists and is properly formatted.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ========================================
echo SUCCESS! Task created successfully.
echo ========================================
echo.
echo The schedule will be exported daily at 6:00 AM
echo.
echo You can manage the task using:
echo   - Task Scheduler GUI (taskschd.msc)
echo   - Command: schtasks /Query /TN "PowerSchool Schedule Export"
echo.
echo To run the task manually right now:
echo   schtasks /Run /TN "PowerSchool Schedule Export"
echo.
echo To delete the task:
echo   schtasks /Delete /TN "PowerSchool Schedule Export" /F
echo.
pause
