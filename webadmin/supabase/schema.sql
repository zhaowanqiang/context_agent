-- contentagent 双轨内容后台 · Supabase schema
-- 在 Supabase Dashboard → SQL Editor 里整段执行一次。
-- 注意：本文件必须以 UTF-8 保存。

create type track_id as enum ('x', 'wechat');

create type run_status as enum (
  'created',          -- 已建 run，素材就绪，尚未出大纲
  'outlining',        -- Hop1 进行中
  'outline_review',   -- 大纲已出，等人改/确认（替代 CLI 的 input() 暂停）
  'drafting',         -- Hop2 进行中
  'gating',           -- Gate 进行中
  'draft_review',     -- 成稿+checklist 已出，等人核对/润色
  'published',        -- 已发布（人工确认后记录）
  'aborted',          -- 人工放弃
  'failed'            -- LLM 调用失败，可重试
);

create type feed_item_status as enum ('new', 'scored', 'shortlisted', 'used', 'discarded');

create table sources (
  id uuid primary key default gen_random_uuid(),
  track track_id not null default 'wechat',
  name text not null,
  feed_url text not null unique,
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table feed_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  track track_id not null default 'wechat',
  guid text not null,                -- rss item guid，缺失时用 link
  title text not null,
  link text not null,
  summary text,                      -- contentSnippet，截断到 ~500 字
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  status feed_item_status not null default 'new',
  score numeric(3,1),                -- LLM 相关性 0-10
  suggested_angle text,              -- LLM 建议的切入角度
  score_reason text,
  unique (source_id, guid)           -- 去重锚点
);
create index on feed_items (status, score desc);

create table runs (
  id uuid primary key default gen_random_uuid(),
  track track_id not null,
  status run_status not null default 'created',
  feed_item_id uuid references feed_items(id),
  title text,                        -- 从大纲首行提取，列表页显示用
  material text not null,
  outline_generated text,
  outline_final text,
  outline_edited boolean,
  draft text,                        -- Hop2 原始输出
  draft_final text,                  -- 人工润色后（发布用）
  checklist text,
  models jsonb,                      -- {"strong": "...", "gate": "..."}
  token_usage jsonb,                 -- {"input_tokens": n, "output_tokens": n}
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on runs (track, status, created_at desc);

create table llm_calls (
  id bigint generated always as identity primary key,
  run_id uuid references runs(id) on delete cascade,  -- 选题打分调用为 null
  step text not null,                -- hop1_outline / hop2_draft / gate_factcheck / score_topics
  model text not null,
  prompt text not null,              -- 全量保留，延续 run.json 的可回放设计
  response text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create table publications (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  channel text not null,             -- 'wechat_clipboard' 现在；'wechat_api'/'x_api' 留位
  title text,
  html text,                         -- 复制那一刻的内联 HTML 快照
  published_at timestamptz not null default now(),
  notes text
);

-- RLS：全部开启但不建 policy —— Next.js 服务端用 service_role key 访问（绕过 RLS），
-- 浏览器永远不直连 Supabase，anon key 不发给任何人。
alter table sources enable row level security;
alter table feed_items enable row level security;
alter table runs enable row level security;
alter table llm_calls enable row level security;
alter table publications enable row level security;

-- 预置公众号轨道 RSS 源（全部 UTF-8 输出）
insert into sources (track, name, feed_url) values
  ('wechat', '少数派', 'https://sspai.com/feed'),
  ('wechat', '爱范儿', 'https://www.ifanr.com/feed'),
  ('wechat', '36氪', 'https://36kr.com/feed'),
  ('wechat', 'InfoQ 中文', 'https://www.infoq.cn/feed');

-- GitHub 热门库源（lib/github.ts 识别 trending URL 走专用解析器；
-- feed_url 有唯一约束，X 轨用 #x 后缀区分，抓取时 hash 不参与请求）
insert into sources (track, name, feed_url) values
  ('wechat', 'GitHub 热门库（公众号）', 'https://github.com/trending?since=daily'),
  ('x', 'GitHub 热门库（X）', 'https://github.com/trending?since=daily#x');

-- ============================================================
-- 增量（2026-07-08）：监控简报模块。已建库的只需在 SQL Editor 执行本段。
-- Cowork 定时任务 GET /api/monitor/topics 取话题 → WebSearch →
-- POST /api/monitor/briefings 回传简报，/monitor 页面查看与管理。
-- ============================================================

create table monitor_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- 话题名（简报分组标题）
  keywords text,                     -- 搜索关键词提示（中英文，Cowork 检索时参考）
  note text,                         -- 筛选备注（该话题额外关注什么）
  enabled boolean not null default true,
  position int not null default 0,   -- 简报内排序
  created_at timestamptz not null default now()
);

create table briefings (
  id uuid primary key default gen_random_uuid(),
  title text not null,               -- 如「每日简报 - 2026-07-08」
  body_md text not null,             -- 简报正文 markdown
  item_count int,                    -- 本期条目数（0 = 无新动态）
  created_at timestamptz not null default now()
);
create index on briefings (created_at desc);

alter table monitor_topics enable row level security;
alter table briefings enable row level security;

-- 预置监控话题。keywords 用短词组（/ 分隔多变体）——长 AND 词组在
-- Google/Reddit 上常年零命中（如 "crypto debit card cashback fee changes"），等于自废检索
insert into monitor_topics (name, keywords, note, position) values
  ('Starryblu', 'Starryblu', null, 1),
  ('Bybit Card', 'Bybit Card / Bybit 卡', null, 2),
  ('KAST', 'KAST card / KAST stablecoin / KAST 卡', '加密支付卡/账户产品', 3),
  ('跨境多币种账户', 'multi-currency account / 多币种账户', null, 4),
  ('加密支付卡返现与费率变动', 'crypto card cashback / crypto card fees / U卡 返现', null, 5),
  ('海外银行开户政策', 'offshore bank account / overseas account opening / 海外银行开户', null, 6);

-- ============================================================
-- 增量（2026-07-11）：个人网站公开层。已建库的只需在 SQL Editor 执行本段。
-- 产线成稿"回流"到自己域名：run 发布后一键生成 post，
-- /posts、rss.xml、sitemap.xml 对公网访客开放（无需登录）。
-- ============================================================

create table posts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete set null,  -- 手写文章可为 null
  track track_id,                    -- 来源轨道（展示徽标用，手写文章可为 null）
  slug text not null unique,         -- URL 段（中文标题不转写，用短 ID）
  title text not null,
  summary text,                      -- 列表页/RSS/OG description 摘要
  content_md text not null,          -- 正文 markdown（回流时取 draft_final）
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on posts (published_at desc);
create unique index on posts (run_id) where run_id is not null;  -- 一个 run 只回流一次

alter table posts enable row level security;

-- ============================================================
-- 增量（2026-07-12）：发布中心 + 剪藏收件箱 + 每周复盘。
-- 已建库的只需在 SQL Editor 执行本段。
-- ============================================================

-- 发布中心①：待发稿的计划发布日期（发布队列按它排序）
alter table runs add column planned_publish_on date;

-- 发布中心②：发布效果回填（发布 48h 后手动填，反哺选题判断）
-- stats 按渠道自由 kv：X={"impressions":n,"engagements":n}，公众号={"reads":n,"likes":n}
alter table publications add column stats jsonb;
alter table publications add column stats_updated_at timestamptz;

-- 剪藏收件箱：平时刷到的素材随手存，第三条选题来源（RSS 抓取、监控简报之外）
create table clips (
  id uuid primary key default gen_random_uuid(),
  url text,                          -- 链接剪藏（与 note 至少一个非空）
  note text,                         -- 文字剪藏 / 备注
  track track_id,                    -- 预判轨道（可空，转素材时再定）
  status text not null default 'new',  -- new / used / discarded
  used_run_id uuid references runs(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on clips (status, created_at desc);
alter table clips enable row level security;

-- 每周复盘：复用 briefings 表，kind 区分（日报=daily 周报=weekly）
alter table briefings add column kind text not null default 'daily';

-- ============================================================
-- 增量（2026-07-28）：公开层教程库。已建库的只需在 SQL Editor 执行本段。
-- X 上发过的教程线程 → 站内常青教程页（/guides）。与 posts 分开：
-- posts 是产线成稿的时效存档（按发布日排流水），guides 是会反复修订的
-- 常青内容（按核对时间标新鲜度），两者版式、更新节奏和 SEO 目标都不同。
-- 与 decider 付费教程也分开：这批是免费引流内容，末尾导向 decider 深度版。
-- ============================================================

create table guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,         -- 人工可读 ASCII（如 kast-card）：教程吃长尾搜索，
                                     -- 不像 posts 那样用随机短 ID
  title text not null,
  summary text,                      -- 列表页 / OG description
  content_md text not null,          -- 正文 markdown（图片以 ![](公开 URL) 内嵌）
  source_url text,                   -- 原推文/线程链接（正文末尾标注出处）
  cover_url text,                    -- 列表页封面（留空则列表页不出图）
  verified_at date,                  -- 最后核对日期：跨境开户政策常变，这是最强信任要素
  status text not null default 'draft',  -- draft / published（草稿不进公开层）
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on guides (status, published_at desc);
alter table guides enable row level security;

-- 教程配图的公开存储桶。X 图片必须转存：pbs.twimg.com 是 X 的 CDN，
-- 删推或防盗链一开，站上的图就全空了。
insert into storage.buckets (id, name, public)
values ('guide-images', 'guide-images', true)
on conflict (id) do nothing;

-- ============================================================
-- 增量（2026-07-29）：转化埋点。已建库的只需在 SQL Editor 执行本段。
-- 公开层访客行为落库：返佣点击 / 答题提交 / 付费墙曝光 / 购买点击。
-- 这是「钱漏在哪一环」的唯一数据来源——Vercel Analytics 只给 PV，
-- 看不出有没有人点返佣链接、付费墙前有多少人掉头走。
-- 无 PII：不写 IP、不写 user_id、不写邮箱，只有行为本身。
-- ============================================================

create table events (
  id bigserial primary key,
  type text not null,          -- lib/events.ts 的 EVENT_TYPES 白名单，API 层已校验
  target text,                 -- 事件对象：产品 id / 教程 id / 档位
  path text,                   -- 发生页面（只取 pathname，query 不入库免得带进意外参数）
  meta jsonb,                  -- 事件特有字段（如答题选择），同样无 PII
  created_at timestamptz not null default now()
);
-- 面板按 type + 时间窗聚合；单独的时间索引给「最近 N 天全表扫」用
create index on events (type, created_at desc);
create index on events (created_at desc);
alter table events enable row level security;

-- ============================================================
-- 增量（2026-08-04）：教程库补建 + 品类 + 返佣位。
--
-- ⚠️ 这一段是幂等的，直接整段贴进 SQL Editor 跑一次即可，跑过也不会报错。
--
-- 背景：上面 2026-07-28 那段「公开层教程库」在生产库里**从来没执行过**
-- （2026-08-04 查库发现 guides 表不存在，而更晚的 events 段反倒跑过了）。
-- 后果是 /guides 一直是空页、/import 一存就报错，X 上发过的教程一篇没上站。
-- 所以这里用 if not exists 重新建一遍，顺带把新字段一起加上——
-- 已建库和没建库的都跑这一段就行，不用去分辨自己漏了哪一段。
-- ============================================================

create table if not exists guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  content_md text not null,
  source_url text,
  cover_url text,
  verified_at date,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guides_status_published_idx on guides (status, published_at desc);
alter table guides enable row level security;

-- 品类：account / server / esim / ai，与 data/referrals.ts 的 REFERRAL_CATEGORIES 对应。
-- 不加 check 约束：品类是产品决策，加一个品类不该还要来跑一次 DDL；
-- 值域由 TS 侧 ReferralCategory 把关，非法值在列表页只表现为"筛不出来"。
alter table guides add column if not exists category text;

-- 文末主推的返佣产品 id 数组（对应 data/referrals.ts 的 REFERRALS[].id）。
-- 为什么不建外键表：返佣产品是代码里的静态数据（要被客户端 import），
-- 不在库里，建不了外键；引用有效性由发布闸门在上站前校验。
alter table guides add column if not exists referral_ids text[] not null default '{}';

-- 教程配图的公开存储桶。X 图片必须转存：pbs.twimg.com 是 X 的 CDN，
-- 删推或防盗链一开，站上的图就全空了。
insert into storage.buckets (id, name, public)
values ('guide-images', 'guide-images', true)
on conflict (id) do nothing;
