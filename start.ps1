# 一键启动：Python LLM 服务（8600）+ Next.js 后台（3000）
# 用法：在项目根目录执行  .\start.ps1
$env:PYTHONUTF8 = "1"

$root = $PSScriptRoot

# Python 服务（新窗口）
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$env:PYTHONUTF8='1'; Set-Location '$root'; python -m uvicorn contentagent.server:app --host 127.0.0.1 --port 8600"
)

# Next.js 后台（新窗口）
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root\webadmin'; npm run dev"
)

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } |
  Select-Object -First 1).IPAddress

Write-Host "已启动：Python http://127.0.0.1:8600  |  后台 http://localhost:3000"
if ($lanIp) {
  Write-Host "手机（同一 Wi-Fi）访问：http://${lanIp}:3000"
  Write-Host "（首次手机访问若打不开，允许 Windows 防火墙对 Node.js 的入站规则）"
}
Write-Host "首次使用：先复制 webadmin\.env.local.example 为 .env.local 并填入 Supabase 凭据。"
