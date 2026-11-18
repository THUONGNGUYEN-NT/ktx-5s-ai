@echo off
title KTX 5S AI - Web dang chay (KHONG tat cua so nay)
cd /d "%~dp0ktx5s-frontend"

if not exist node_modules (
  echo Dang cai thu vien lan dau, vui long cho 2-5 phut...
  call npm install
)

echo.
echo ===============================================
echo   Dang khoi dong web KTX 5S AI...
echo   Trinh duyet se tu mo sau khoang 10 giay.
echo   Muon tat web: dong cua so nay.
echo ===============================================
echo.

start "" cmd /c "timeout /t 10 >nul & start http://localhost:3000"
call npm run dev
pause
