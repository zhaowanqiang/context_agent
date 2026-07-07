# contentagent

双轨内容生产系统：把实测原始笔记生成为可发布的内容，两跳生成 + 事实闸门，human-in-the-loop。

- **X 轨道**：跨境金融 / 加密支付卡实测 → @zynqorw 风格干货帖
- **公众号轨道**：AI 工具与效率实测 → 1500–3000 字长文（大陆合规红线，独立于 X 轨道）

```
Hop 1  出大纲（强模型，默认 deepseek-v4-pro）
  ↓    ★ 人工闸口：CLI 改文件回车 / 网页后台编辑确认
Hop 2  大纲 + few-shot 出成稿（强模型）
Gate   红线检查 + 待核实清单（小模型，默认 deepseek-v4-flash）
```

## 两种用法

**① 网页后台（推荐）**：RSS 选题 → 生成 → 网页改大纲 → 成稿 → 核对 checklist →
公众号一键复制排版好的正文（个人订阅号无发布 API，粘贴进 mp.weixin.qq.com 发布）。

```powershell
.\start.ps1     # 同时启动 Python 服务(8600) + Next.js 后台(3000)
```

首次使用：
1. 到 https://supabase.com 免费建项目，SQL Editor 里执行 `webadmin/supabase/schema.sql`
2. 复制 `webadmin/.env.local.example` 为 `webadmin/.env.local`，填入项目 URL 和 service_role key
3. `pip install -r requirements.txt`；`cd webadmin && npm install`
4. 复制 `tracks/x/style.md.example` 和 `tracks/wechat/style.md.example` 为同目录 `style.md`，
   按自己的账号定位改写（风格指纹与 few-shot 范例属个人内容资产，不随仓库分发）

**② CLI（单篇快跑）**：

```powershell
python -m contentagent run --material X_post/某教程.txt              # X 轨道（默认）
python -m contentagent run --track wechat --material notes.txt      # 公众号轨道
python -m contentagent run --material notes.txt -v                  # 打印完整 prompt
```

CLI 流程中会暂停一次：大纲写入 `runs/<运行ID>/outline.md`，直接改文件，改完回车继续；
输入 `q` 放弃。产物在 `runs/<运行ID>/`（outline.md / draft.md / checklist.md / run.json）。

## 项目结构

```
contentagent/            # Python 包
├── cli.py               # CLI 入口（--track x|wechat）
├── config.py            # 供应商（deepseek/anthropic）、模型、超时
├── tracks.py            # 轨道配置（路径 + token 预算；红线只引用 prompts.REDLINES）
├── prompts.py           # 按轨道组织的模板；红线硬编码在这里，改 style.md 删不掉
├── steps.py             # 无状态步骤函数（CLI 与 FastAPI 共用底座）
├── server.py            # FastAPI：/health /steps/* /topics/score（127.0.0.1:8600）
├── llm.py / loader.py / recorder.py / errors.py / pipeline.py
tracks/
├── x/style.md           # X 轨道风格指纹 + fewshot/
└── wechat/style.md      # 公众号轨道风格指纹 + fewshot/
webadmin/                # Next.js 本地后台（Supabase 云库）
├── supabase/schema.sql  # 建表脚本（含 4 个预置 RSS 源）
├── app/                 # 平台选择首页 + /wechat、/x 两个独立模块（各自仪表盘/选题池/内容源/Runs）
├── lib/wechat/          # md → 公众号内联 HTML 排版
└── lib/publishers/      # 发布通道接口（现为剪贴板，认证号 API 留位）
runs/                    # CLI 模式运行记录（Web 模式记录在 Supabase）
demo/                    # 演示素材
```

## 配 API Key

默认供应商 DeepSeek（https://platform.deepseek.com 拿 key）。项目根目录 `.env`：

```
DEEPSEEK_API_KEY=sk-...
```

环境变量优先于 .env。切 Claude 官方：`config.py` 里 `PROVIDER = "anthropic"` + `ANTHROPIC_API_KEY`。
一次完整运行约 ¥0.05–0.15（公众号长文略贵）。

## 改风格 / 加范例 / 换模型

- **改风格**：改 `tracks/<轨道>/style.md`，下次运行生效
- **加 few-shot**：表现好的成稿存 `tracks/<轨道>/fewshot/NN-名字.md`（人工终稿，别放机器原稿），建议 5–8 条
- **换模型/预算**：`contentagent/config.py`（供应商级）、`contentagent/tracks.py`（轨道 token 预算）
- **红线**：硬编码在 `contentagent/prompts.py`（REDLINES，每轨道一份），三段 prompt 全注入，Gate 额外复查。
  X 轨道：不碰伪造证件/材料造假/绕过 KYC；公众号轨道：另加不碰加密货币/翻墙工具/灰色跨境金融/时政

## 发布流程（公众号，个人订阅号）

工作台 draft_review 状态：左边润色 markdown，右边 375px 手机预览 →
「复制排版好的正文」（内联样式富文本）→ 粘贴进公众号编辑器 → `[截图：xxx]` 占位处手动传图 →
群发。正文外链会被公众号剥离，渲染时已自动转成「文字（链接：url）」明文。

## 注意事项

- Supabase 免费层 7 天无活动会暂停项目，每周至少用一次
- 生成中别关页面；卡死超 10 分钟工作台会出现「重置重试」
- 新加 RSS 源先确认是 UTF-8 输出
- `content_agent_v1.py` 是第一版单文件脚本，保留作历史参照
