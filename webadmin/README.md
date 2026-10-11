# webadmin

contentagent 的 Next.js 后台（项目总览见[根目录 README](../README.md)）。
Supabase 存数据，Python 服务（127.0.0.1:8600）跑 LLM 步骤，本应用负责全部交互与定时调度。

## 模块

| 路径 | 内容 |
|---|---|
| `/agent/wechat`、`/agent/x` | 双轨内容产线：选题池 → 生成 → 审稿 → 发布，范例库管理 |
| `/monitor` | 监控简报：每天检索监控话题出一期；`/api/monitor/*` 供外部（Cowork）推送，`x-monitor-token` 鉴权 |
| `/tutorials` | 教程导航，公开层。唯一数据源 `data/tutorials.json`；暂不上线的分类在 `lib/tutorials.ts` 的 `HIDDEN_CATEGORIES` |
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
   不要猜返现比例、年费、限额、地区政策——这跟对比表是同一条原则：
   没有结构化来源就不出现，宁可空着。叙述性字段缺内容用 `TODO:` 前缀标出。
2. **邀请码和注册链接不写进这个文件。** 给卡片加一个 `tutorial: { slug, item? }` 指向
   教程导航里的教程，详情面板会从 `data/tutorials.json` 带出码和链接并互相链接。
3. **要进筛选（大陆可用）、KYC 排序、3 问推荐和对比表，得在 `data/card-eligibility.ts`
   里加一条，`id` 与卡片 `slug` 对上。** 没有实测来源的开卡条件不写，对应的卡自然不会进推荐。

决策器的权重不在这个模块里：`lib/cryptoCards.ts` 只做「3 个问题 → Answers」的翻译，
真正的打分在 `lib/cardEligibility.ts` 的 `scoreCard`。

动效（3D 倾斜 / 高光 / 扫光 / 悬停浮起）写在 `app/globals.css` 的 `.cc-*` 规则里，
组件只用 `requestAnimationFrame` 写 CSS 变量，不在 `mousemove` 里 `setState`。
改动效去改 CSS，别往组件里加状态。
