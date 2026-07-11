# webadmin

contentagent 的 Next.js 后台（项目总览见[根目录 README](../README.md)）。
Supabase 存数据，Python 服务（127.0.0.1:8600）跑 LLM 步骤，本应用负责全部交互与定时调度。

## 模块

| 路径 | 内容 |
|---|---|
| `/agent/wechat`、`/agent/x` | 双轨内容产线：选题池 → 生成 → 审稿 → 发布，范例库管理 |
| `/monitor` | 监控简报：每天检索监控话题出一期；`/api/monitor/*` 供外部（Cowork）推送，`x-monitor-token` 鉴权 |
| `/decider` | 跳转独立应用（3100） |

## 鉴权

全站访问码登录（`proxy.ts`，Next 16 的 middleware 后继者）：
`.env.local` 配 `ADMIN_ACCESS_CODE`，首次访问输码，cookie 半年有效。
改码 = 所有设备下线。不配则不验证（仅纯本机使用时可接受）。

## 定时任务（instrumentation.ts）

- 产线 `AUTOPILOT_CRON`（默认 08:00）、简报 `BRIEFING_CRON`（默认 09:00），设 `off` 关闭
- 错过补跑：服务启动 2 分钟后检查 `runs/cron-stamps/` 运行戳，当天该跑没跑的自动补（仅生产模式）
- 告警双通道：本机 toast + Telegram（`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`，见 `.env.local.example`）

## 开发

```powershell
npm run dev     # 热更新（生产日常用根目录 start.ps1）
npm run build && npm run start
node scripts/e2e-smoke.mjs          # 真浏览器全流程冒烟（--llm 会花约 ¥0.03）
node scripts/shot.mjs [url] [out]   # 截图（自动带登录 cookie）
node scripts/dump-supabase.mjs out/ # 全表导出（备份用，backup.ps1 会调）
```

注意：next 版本锁死在精确 canary（升级需实测，canary 间随时 breaking）；
写代码前先看 `node_modules/next/dist/docs/`（见 AGENTS.md）。
