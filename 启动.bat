@echo off
rem 双击启动整套系统（等价于在 PowerShell 里执行 .\start.ps1，可重复运行）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
