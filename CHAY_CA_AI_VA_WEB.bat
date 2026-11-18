@echo off
title KTX 5S AI - Khoi dong ca AI Backend va Web Frontend
cd /d "%~dp0"

echo =======================================================
echo   BUOC 1: Khoi dong AI Backend cua Sinh vien A (:8000)
echo =======================================================
if exist "backend\venv\Scripts\activate.bat" (
  start "KTX5S AI Backend (:8000)" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
) else (
  start "KTX5S AI Backend (:8000)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --reload --port 8000"
)

echo =======================================================
echo   BUOC 2: Khoi dong Web Frontend cua Sinh vien B (:3000)
echo =======================================================
cd /d "%~dp0ktx5s-frontend"
start "" cmd /c "timeout /t 8 >nul & start http://localhost:3000"
call npm run dev
pause
