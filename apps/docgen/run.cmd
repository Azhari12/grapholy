@echo off
REM Grapholy — jalankan Python docgen service (Windows)
cd /d "%~dp0"
".venv\Scripts\python.exe" -m uvicorn main:app --port 8787 --app-dir src --reload
