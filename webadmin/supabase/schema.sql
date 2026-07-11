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

-- 预置监控话题
insert into monitor_topics (name, keywords, note, position) values
  ('Starryblu', 'Starryblu', null, 1),
  ('Bybit Card', 'Bybit Card / Bybit 卡', null, 2),
  ('KAST', 'KAST crypto card / KAST 加密支付卡', '加密支付卡/账户产品', 3),
  ('跨境多币种账户', 'cross-border multi-currency account / 跨境多币种账户', null, 4),
  ('加密支付卡返现与费率变动', 'crypto debit card cashback fee changes / 加密支付卡 返现 费率', null, 5),
  ('海外银行开户政策', 'overseas bank account opening policy changes / 海外银行开户政策', null, 6);
