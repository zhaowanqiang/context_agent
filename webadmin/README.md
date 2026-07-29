# webadmin

contentagent 的 Next.js 后台（项目总览见[根目录 README](../README.md)）。
Supabase 存数据，Python 服务（127.0.0.1:8600）跑 LLM 步骤，本应用负责全部交互与定时调度。

## 模块

| 路径 | 内容 |
|---|---|
| `/agent/wechat`、`/agent/x` | 双轨内容产线：选题池 → 生成 → 审稿 → 发布，范例库管理 |
| `/monitor` | 监控简报：每天检索监控话题出一期；`/api/monitor/*` 供外部（Cowork）推送，`x-monitor-token` 鉴权 |
| `/decider` | 跳转独立应用（3100） |
| `/cards` | 加密卡片：卡片网格 → 详情（开户决策 / 申请教程 / 常见问题），公开层。数据在 `data/crypto-cards.ts` |

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

## 加密卡片（/cards）：怎么新增一张卡

只改 `data/crypto-cards.ts`，往 `cards` 数组里加一条即可——网格、筛选、排序、详情、
决策器、对比表全部读同一份数据，组件不用动。

```ts
{
  slug: "xxx",              // 唯一；同时是 URL hash（/cards#card-xxx）
  name: "XXX 卡",
  issuer: "Visa",           // 不确定就写 null，卡面上不会印出来
  art: { type: "gradient", from: "#78350f", to: "#292524", textColor: "light" },
  badges: ["卖点一", "卖点二"],
  invite: { code: "ABC123", url: "https://..." },   // 没有直达链接就 null + signupNote
  status: "live",           // live / waitlist / invite-only / deprecated
  facts:   { /* 见类型定义 */ },
  decision:{ /* 见类型定义 */ },
  tutorial:{ /* 见类型定义 */ },
}
```

三条规矩，加卡前先看：

1. **不确定的事实一律写 `null`**，页面会渲染成「待核实」。
   不要猜返现比例、年费、限额、地区政策——这跟 `ComparisonTable` 是同一条原则：
   没有结构化来源就不出现，宁可空着。叙述性字段缺内容用 `TODO:` 前缀标出。
2. **绝不把付费教程正文写进这个文件。** 它被客户端组件 import，内容会进浏览器
   JS bundle。付费正文只能待在 `data/decider/guides.ts`（那个文件是 `server-only`），
   这里用 `tutorial.guide.href` 链过去，由 `/decider/guide/[id]` 的付费墙判定。
3. **`slug` 要和 `data/decider/products.ts` 里的 `id` 对上**，筛选（大陆可用）和
   决策器打分都靠这个 join。products.ts 里没有对应条目的卡不会进决策器推荐。

决策器的权重不在这个模块里：`lib/cryptoCards.ts` 只做「3 个问题 → Answers」的翻译，
真正的打分在 `lib/decider/match.ts` 的 `scoreProduct`，改那一处 `/cards` 和 `/decider` 同时生效。

动效（3D 倾斜 / 高光 / 扫光 / 悬停浮起）写在 `app/globals.css` 的 `.cc-*` 规则里，
组件只用 `requestAnimationFrame` 写 CSS 变量，不在 `mousemove` 里 `setState`。
改动效去改 CSS，别往组件里加状态。
