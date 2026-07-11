# 内容资产 + Supabase 数据备份 → D:\context_agent_backup（独立 git 仓库，push 到私有 GitHub）
# 备什么：主仓库 .gitignore 刻意排除、但恰恰最难重建的东西——
#   tracks/   范例库 + 风格指纹（个人内容资产的核心）
#   X_post/   已发内容存档
#   runs/     产线运行记录（含素材原文）
#   supabase/ 全表 JSON dump（免费档没有自动备份，这就是我们的备份）
# 用法：.\backup.ps1   （setup-autostart.ps1 注册的任务每天 21:30 自动跑）
# 首次使用：GitHub 建私有仓库 context-agent-backup 后执行
#   git -C D:\context_agent_backup remote add origin git@github.com:zhaowanqiang/context-agent-backup.git
$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
$dest = "D:\context_agent_backup"

# 备份仓库不存在则初始化
if (-not (Test-Path "$dest\.git")) {
  New-Item -ItemType Directory -Force $dest | Out-Null
  git -C $dest init | Out-Null
  git -C $dest config core.autocrlf false  # 备份文件按原样存，避免 CRLF 警告和假 diff
  Set-Content -Path "$dest\README.md" -Encoding utf8 -Value @"
# context_agent 私有备份

由 ``context_agent\backup.ps1`` 每天自动生成，内容为主仓库不收录的个人内容资产和 Supabase 全表导出。
不要手动编辑——下次备份会被镜像覆盖。
"@
  Write-Host "已初始化备份仓库 $dest"
}

# 镜像复制（/MIR 保证删除也同步；robocopy 退出码 0-7 都算成功）
foreach ($dir in @("tracks", "X_post", "runs")) {
  if (Test-Path "$root\$dir") {
    robocopy "$root\$dir" "$dest\$dir" /MIR /NFL /NDL /NJH /NJS | Out-Null
    if ($LASTEXITCODE -ge 8) { Write-Warning "robocopy $dir 失败（退出码 $LASTEXITCODE）" }
    else { Write-Host "✓ $dir" }
  }
}

# Supabase 全表 dump
Push-Location "$root\webadmin"
node scripts\dump-supabase.mjs "$dest\supabase"
$dumpOk = ($LASTEXITCODE -eq 0)
Pop-Location
if (-not $dumpOk) { Write-Warning "Supabase dump 失败（数据表备份不完整，文件资产照常提交）" }

# 提交 + 推送（无改动则跳过；没配远端只提交本地）
git -C $dest add -A
git -C $dest diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git -C $dest commit -m "backup $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
  Write-Host "✓ 已提交"
  $remote = git -C $dest remote
  if ($remote) {
    git -C $dest push -u origin HEAD 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "✓ 已推送到远端" }
    else { Write-Warning "推送失败（本地提交已保住；检查网络或远端配置）" }
  } else {
    Write-Host "（未配置远端：GitHub 建好私有仓库后 git -C $dest remote add origin <地址>）"
  }
} else {
  Write-Host "无改动，跳过提交"
}
