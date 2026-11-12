@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://localhost:8080
py serve.py %* 2>nul || python serve.py %*
pause
