@echo off
REM Grapholy — jalankan Python docgen service (Windows)
REM Auto-setup: buat venv + install dependency kalau belum ada.
cd /d "%~dp0"

REM 1. Cek Python tersedia
where python >nul 2>nul
if errorlevel 1 (
  echo [docgen] ERROR: Python tidak ditemukan di PATH.
  echo [docgen] Install Python 3.10+ dari https://www.python.org/downloads/
  echo [docgen] Pastikan centang "Add Python to PATH" saat install.
  exit /b 1
)

REM 2. Buat venv kalau belum ada
if not exist ".venv\Scripts\python.exe" (
  echo [docgen] .venv belum ada — membuat virtualenv + install dependency ^(sekali saja^)...
  python -m venv .venv
  if errorlevel 1 (
    echo [docgen] ERROR: gagal membuat venv.
    exit /b 1
  )
  ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
  ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt
  if errorlevel 1 (
    echo [docgen] ERROR: gagal install dependency ^(lihat requirements.txt^).
    exit /b 1
  )
  echo [docgen] Setup selesai.
)

REM 3. Jalankan uvicorn — listen 127.0.0.1 eksplisit (hindari ambiguitas IPv6)
echo [docgen] Menjalankan docgen di http://127.0.0.1:8787 ...
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8787 --app-dir src --reload
