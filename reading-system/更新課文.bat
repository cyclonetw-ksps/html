@echo off
chcp 65001 >nul
title 課文索引更新工具
cls

echo.
echo ╔════════════════════════════════════════╗
echo ║      📚 課文索引自動更新工具 📚        ║
echo ╠════════════════════════════════════════╣
echo ║  這個工具會自動掃描 DATA 資料夾        ║
echo ║  並更新 data-index.json 檔案           ║
echo ╚════════════════════════════════════════╝
echo.

:: 檢查 Python 是否安裝
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 錯誤：找不到 Python！
    echo 📥 請先安裝 Python: https://www.python.org/
    echo.
    pause
    exit /b 1
)

:: 執行更新腳本
python update.py

:: 檢查執行結果
if errorlevel 1 (
    echo.
    echo ❌ 更新失敗！請檢查錯誤訊息
) else (
    echo.
    echo ✅ 更新成功！
)

echo.
echo 按任意鍵結束...
pause >nul