@echo off
title KTX 5S AI - Dong goi va day len GitHub Pages
cd /d "%~dp0ktx5s-frontend"

echo Dang dong goi giao dien web...
set NEXT_BASE_PATH=/ktx-5s-ai
call npm run build

if %ERRORLEVEL% NEQ 0 (
  echo Loi khi dong goi!
  pause
  exit /b 1
)

xcopy /E /Y "out\*" "..\" >nul
type nul > "..\.nojekyll"

cd /d "%~dp0"
git add .
git commit -m "deploy: update GitHub Pages static build"
git push origin main

echo =======================================================
echo   DA CAP NHAT THANH CONG LEN GITHUB PAGES!
echo   Cho 1 phut roi mo: https://thuongnguyen-nt.github.io/ktx-5s-ai/
echo =======================================================
pause
