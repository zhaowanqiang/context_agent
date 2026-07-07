# 一键启动：Python LLM 服务（8600）+ Next.js 后台（3000）
# 用法：在项目根目录执行  .\start.ps1
#   日常使用走生产模式；代码没改动时跳过 build 直接 start（秒起）
#   改代码调试时用  .\start.ps1 -Dev  （热更新，但每个页面首次打开要现场编译，会慢几秒）
#   构建缓存出问题时用  .\start.ps1 -Rebuild  强制重新 build
param([switch]$Dev, [switch]$Rebuild)
$env:PYTHONUTF8 = "1"

$root = $PSScriptRoot

# Python 服务（新窗口）
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "`$env:PYTHONUTF8='1'; Set-Location '$root'; python -m uvicorn contentagent.server:app --host 127.0.0.1 --port 8600"
)

# 上次 build 之后源码没动过 → 跳过 build（全量 build 要一分钟左右，日常启动省掉）
function Test-BuildFresh {
  $buildId = "$root\webadmin\.next\BUILD_ID"
  if (-not (Test-Path $buildId)) { return $false }
  $buildTime = (Get-Item $buildId).LastWriteTime
  $srcDirs = @("$root\webadmin\app", "$root\webadmin\components", "$root\webadmin\lib") | Where-Object { Test-Path $_ }
  $srcFiles = @(Get-ChildItem $srcDirs -Recurse -File)
  $srcFiles += @(Get-ChildItem "$root\webadmin" -File | Where-Object {
    $_.Name -in @("package.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "instrumentation.ts")
  })
  $newest = $srcFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  return ($null -ne $newest -and $newest.LastWriteTime -lt $buildTime)
}

# Next.js 后台（新窗口）
$webCmd = if ($Dev) {
  "npm run dev"
} elseif (-not $Rebuild -and (Test-BuildFresh)) {
  Write-Host "代码无改动，跳过 build 直接启动（需要重建时用 .\start.ps1 -Rebuild）"
  "npm run start"
} else {
  "npm run build; if (`$?) { npm run start }"
}
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "Set-Location '$root\webadmin'; $webCmd"
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
