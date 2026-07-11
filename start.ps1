# 一键启动：Python LLM 服务（8600）+ Next.js 后台（3000）
# 用法：在项目根目录执行  .\start.ps1
#   日常使用走生产模式；代码没改动时跳过 build 直接 start（秒起）
#   改代码调试时用  .\start.ps1 -Dev  （热更新，但每个页面首次打开要现场编译，会慢几秒）
#   构建缓存出问题时用  .\start.ps1 -Rebuild  强制重新 build
#   -IfDown：服务已在运行时直接退出（任务计划的每日唤醒用，不打扰正在跑的服务）
param([switch]$Dev, [switch]$Rebuild, [switch]$IfDown)
$env:PYTHONUTF8 = "1"

$root = $PSScriptRoot

if ($IfDown) {
  $alive = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  if ($alive) { Write-Host "服务已在运行（3000 在听），-IfDown 退出"; exit 0 }
}

# 日志落盘：窗口里照常滚动，同时追加到 logs\<进程>-<日期>.log
# （排查「昨天产线为什么没跑」全靠它；窗口一关输出就没了）
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
Get-ChildItem "$logDir\*.log" -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item -Force -ErrorAction SilentlyContinue
$stamp = Get-Date -Format "yyyyMMdd"

# 端口被上次启动的残留进程占用时先停掉 —— 本脚本重复运行总是安全的，
# 不用手动找窗口关进程，直接重跑 .\start.ps1 即等于「重启整套系统」
function Stop-PortOwner([int]$port) {
  $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  foreach ($c in $conns | Select-Object -Unique OwningProcess) {
    try {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop
      Write-Host "端口 $port 有旧进程残留 (PID $($c.OwningProcess))，已停止"
    } catch {}
  }
}
Stop-PortOwner 8600
Stop-PortOwner 3000
Stop-PortOwner 3100

# Python 服务（新窗口）
# cmd /c "... 2>&1" 先在 cmd 层合并输出流，PowerShell 才不会把 stderr 包成红色 ErrorRecord
$pyLog = Join-Path $logDir "python-$stamp.log"
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8; `$env:PYTHONUTF8='1'; Set-Location '$root'; " +
  "filter L { `$_; Add-Content -Path '$pyLog' -Value `$_ -Encoding UTF8 }; " +
  "cmd /c 'python -m uvicorn contentagent.server:app --host 127.0.0.1 --port 8600 2>&1' | L"
)

# 上次 build 之后源码没动过 → 跳过 build（全量 build 要一分钟左右，日常启动省掉）
function Test-BuildFresh {
  $buildId = "$root\webadmin\.next\BUILD_ID"
  if (-not (Test-Path $buildId)) { return $false }
  $buildTime = (Get-Item $buildId).LastWriteTime
  $srcDirs = @("$root\webadmin\app", "$root\webadmin\components", "$root\webadmin\lib") | Where-Object { Test-Path $_ }
  $srcFiles = @(Get-ChildItem $srcDirs -Recurse -File)
  $srcFiles += @(Get-ChildItem "$root\webadmin" -File | Where-Object {
    $_.Name -in @("package.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "instrumentation.ts", "proxy.ts")
  })
  $newest = $srcFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  return ($null -ne $newest -and $newest.LastWriteTime -lt $buildTime)
}

# Next.js 后台（新窗口）—— 命令交给 cmd 执行（&& 链接），日志同 Python 的套路
$webCmd = if ($Dev) {
  "npm run dev"
} elseif (-not $Rebuild -and (Test-BuildFresh)) {
  Write-Host "代码无改动，跳过 build 直接启动（需要重建时用 .\start.ps1 -Rebuild）"
  "npm run start"
} else {
  "npm run build && npm run start"
}
$webLog = Join-Path $logDir "web-$stamp.log"
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Set-Location '$root\webadmin'; " +
  "filter L { `$_; Add-Content -Path '$webLog' -Value `$_ -Encoding UTF8 }; " +
  "cmd /c '$webCmd 2>&1' | L"
)

# 出海开户决策工具（独立应用，3100；门户 /decider 跳转过来）
if (Test-Path "$root\decider\package.json") {
  $deciderCmd = if ($Dev) {
    "npm run dev"
  } elseif (-not $Rebuild -and (Test-Path "$root\decider\.next\BUILD_ID")) {
    "npm run start"
  } else {
    "npm run build && npm run start"
  }
  $deciderLog = Join-Path $logDir "decider-$stamp.log"
  Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Set-Location '$root\decider'; " +
    "filter L { `$_; Add-Content -Path '$deciderLog' -Value `$_ -Encoding UTF8 }; " +
    "cmd /c '$deciderCmd 2>&1' | L"
  )
}

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } |
  Select-Object -First 1).IPAddress

Write-Host "已启动：Python http://127.0.0.1:8600  |  后台 http://localhost:3000  |  决策工具 http://localhost:3100"
Write-Host "日志落盘：$logDir（按日分文件，保留 30 天）"
if ($lanIp) {
  Write-Host "手机（同一 Wi-Fi）访问：http://${lanIp}:3000"
  Write-Host "（首次手机访问若打不开，允许 Windows 防火墙对 Node.js 的入站规则）"
}
Write-Host "首次使用：先复制 webadmin\.env.local.example 为 .env.local 并填入 Supabase 凭据。"
