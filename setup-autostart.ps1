# 注册两个任务计划，让整套系统无人值守地转（重复运行安全，会覆盖旧任务）：
#   1. context-agent 登录启动   —— 开机登录后自动跑 start.ps1
#   2. context-agent 每日唤醒   —— 每天 07:50 把睡眠中的 PC 唤醒并确保服务在跑
#      （07:50 早于产线 08:00 / 简报 09:00；PC 彻底关机则唤不醒，
#        靠下次开机登录启动 + 服务内置的错过补跑兜底）
#   3. context-agent 每日备份   —— 每天 21:30 跑 backup.ps1（内容资产 + Supabase → 私有仓库）
# 用法：.\setup-autostart.ps1        注册
#       .\setup-autostart.ps1 -Remove 卸载
param([switch]$Remove)

$root = $PSScriptRoot
$startScript = Join-Path $root "start.ps1"

$taskLogon = "context-agent 登录启动"
$taskWake = "context-agent 每日唤醒"
$taskBackup = "context-agent 每日备份"

if ($Remove) {
  foreach ($t in @($taskLogon, $taskWake, $taskBackup)) {
    try { Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction Stop; Write-Host "已卸载：$t" } catch {}
  }
  exit 0
}

if (-not (Test-Path $startScript)) { Write-Error "找不到 $startScript"; exit 1 }

# 1) 登录时启动（延迟 30 秒等网络就绪）
$actionLogon = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File `"$startScript`"" -WorkingDirectory $root
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$triggerLogon.Delay = "PT30S"
$settingsLogon = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskLogon -Action $actionLogon -Trigger $triggerLogon `
  -Settings $settingsLogon -Force | Out-Null
Write-Host "已注册：$taskLogon（登录后 30 秒运行 start.ps1）"

# 2) 每天 07:50 唤醒 PC；服务还活着就 -IfDown 直接退出，不打扰
$actionWake = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File `"$startScript`" -IfDown" -WorkingDirectory $root
$triggerWake = New-ScheduledTaskTrigger -Daily -At "07:50"
$settingsWake = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskWake -Action $actionWake -Trigger $triggerWake `
  -Settings $settingsWake -Force | Out-Null
Write-Host "已注册：$taskWake（每天 07:50 唤醒并确保服务在跑）"

# 3) 每天 21:30 备份（内容资产 + Supabase dump → D:\context_agent_backup，有远端则推送）
$backupScript = Join-Path $root "backup.ps1"
$actionBackup = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-ExecutionPolicy Bypass -File `"$backupScript`"" -WorkingDirectory $root
$triggerBackup = New-ScheduledTaskTrigger -Daily -At "21:30"
$settingsBackup = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable  # 21:30 睡着/关机就错过了？-StartWhenAvailable 让它下次开机尽快补跑
Register-ScheduledTask -TaskName $taskBackup -Action $actionBackup -Trigger $triggerBackup `
  -Settings $settingsBackup -Force | Out-Null
Write-Host "已注册：$taskBackup（每天 21:30，错过则开机补跑）"

# 唤醒定时器依赖电源设置允许
Write-Host ""
Write-Host "提醒：若 PC 睡眠后 07:50 没被唤醒，检查「电源选项 → 更改计划设置 →"
Write-Host "高级电源设置 → 睡眠 → 允许使用唤醒定时器」需为「启用」。"
Write-Host "PC 彻底关机无法定时唤醒——开机登录后会自动启动并补跑当天错过的任务。"
