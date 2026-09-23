// 批量导入：X_post/ 下手存的 X 教程线程原文 → guides 表草稿。
//
// 为什么要有这个脚本：/import 页一次只能贴一篇，而积压的存量有一批。
// 拆条逻辑直接复用 lib/xthread.ts（Node 24 能直接 import .ts），
// 不重写一份——两套解析器迟早会不一致。
//
// 幂等：slug 已存在就跳过（不覆盖你在后台改过的正文）。
// 用法：node scripts/import-x-threads.mjs         # 预览，不写库
//       node scripts/import-x-threads.mjs --apply # 实际写入草稿
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./authCookie.mjs";
import { countUnfilledSlots, threadToMarkdown } from "../lib/xthread.ts";

const apply = process.argv.includes("--apply");
const SRC = new URL("../../X_post/", import.meta.url);

/**
 * 存量线程 → 站内教程的映射。
 * slug 与 data/referrals.ts 里各产品的 guideSlug 对齐——对不上的话，
 * /deals 卡片上那个「看教程」就会指向 404。
 * referral 留空表示这篇没有可挂的返佣产品（Plasma One 只能蹲邀请码，
 * Apple ID 本来就没有返佣），不硬凑。
 */
const PLAN = [
  { file: "Wise 教程.txt", slug: "wise-account", title: "Wise 多币种账户开户教程：大陆身份证直开，附香港 DBS 账户申请", category: "account", referral_ids: ["wise"] },
  { file: "KAST 开卡教程.txt", slug: "kast-card", title: "KAST Visa 稳定币卡开卡教程：大陆护照可办，无需海外地址", category: "account", referral_ids: ["kast"] },
  { file: "Bybit 开卡教程.txt", slug: "bybit-card", title: "Bybit Card 开卡教程：5 分钟拿卡，订阅 AI 服务够用", category: "account", referral_ids: ["bybit-card"] },
  { file: "Savo开卡教程.txt", slug: "savo-card", title: "SAVO Visa 借记卡开卡教程：门槛最低的一张，记得填邀请码免开卡费", category: "account", referral_ids: ["savo"] },
  { file: "plasma one 开卡教程.txt", slug: "plasma-one", title: "Plasma One 开卡教程：Visa 借记卡 + 欧洲 IBAN 账户", category: "account", referral_ids: [] },
  { file: "注册Apple ID教程.txt", slug: "apple-id", title: "注册美区 Apple ID 教程：不用信用卡，下载区域限定 App", category: "account", referral_ids: [] },
];

/** 摘要：正文首个非标题、非图片段落（与 app/actions/guides.ts 的 summarize 同规则） */
function summarize(md, limit = 120) {
  const line = md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !/^[#>\-*|![]/.test(l) && !l.startsWith("---"));
  return (line ?? "").replace(/\*\*|`|\[([^\]]*)\]\([^)]*\)/g, "$1").slice(0, limit);
}

// 全程不调 process.exit()：Supabase 客户端还挂着 keep-alive 连接，
// 在 Windows 上强杀进程会撞 libuv 的 UV_HANDLE_CLOSING 断言，
// 屏幕上多出一行看着像崩溃的报错。设 exitCode 让 Node 自己收尾。
async function main() {
  const env = readEnvLocal();
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 先探一下表在不在：这批内容此前一篇没上站，就是因为建表增量从没执行过。
  // 直接报「表不存在」比让 6 条 insert 各报一次同样的错清楚得多。
  const probe = await db.from("guides").select("slug").limit(1);
  if (probe.error) {
    console.error(`✗ 读 guides 表失败：${probe.error.message}`);
    console.error("  → 把 webadmin/supabase/schema.sql 末尾「增量（2026-08-04）」整段");
    console.error("    贴进 Supabase SQL Editor 跑一次，再回来执行本脚本。");
    process.exitCode = 1;
    return;
  }

  const { data: existing } = await db.from("guides").select("slug");
  const have = new Set((existing ?? []).map((g) => g.slug));

  let added = 0;
  let skipped = 0;
  for (const p of PLAN) {
    if (have.has(p.slug)) {
      console.log(`- 跳过 ${p.slug}（已存在）`);
      skipped += 1;
      continue;
    }

    let raw;
    try {
      raw = readFileSync(new URL(p.file, SRC), "utf-8");
    } catch {
      console.error(`✗ 读不到 X_post/${p.file}，跳过`);
      continue;
    }

    const md = threadToMarkdown(raw);
    const slots = countUnfilledSlots(md);
    console.log(
      `${apply ? "+" : "·"} ${p.slug} | ${md.length} 字符 | 配图位 ${slots} | 返佣 ${p.referral_ids.join(",") || "无"}`
    );

    if (!apply) continue;

    // 一律入 draft：拆条是机械变换，正文还得人过一遍（补图、润色、挂返佣位）
    const { error } = await db.from("guides").insert({
      slug: p.slug,
      title: p.title,
      summary: summarize(md),
      content_md: md,
      category: p.category,
      referral_ids: p.referral_ids,
      status: "draft",
    });
    if (error) console.error(`  ✗ 写入失败：${error.message}`);
    else added += 1;
  }

  console.log(
    apply
      ? `\n完成：新增 ${added} 篇草稿，跳过 ${skipped} 篇。去 /import 逐篇补图、挂返佣位，再发布。`
      : `\n预览完毕（未写库）。加 --apply 实际导入。已存在 ${skipped} 篇。`
  );
}

await main();
