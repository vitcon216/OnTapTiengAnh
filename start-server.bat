@echo off
chcp 65001 > nul
title EngVocab - Local Server
echo ============================================
echo   EngVocab - Khoi dong server hoc tu vung
echo ============================================
echo.
echo Dang khoi dong server tai: http://localhost:8080
echo.
echo Ban co the dong cua so nay sau khi trinh duyet mo.
echo De dung server, dong cua so nay.
echo.
start "" "http://localhost:8080"
python -m http.server 8080
pause
