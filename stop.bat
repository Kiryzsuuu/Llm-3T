@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
echo.
echo Tekan tombol apa saja untuk menutup jendela ini.
pause >nul
