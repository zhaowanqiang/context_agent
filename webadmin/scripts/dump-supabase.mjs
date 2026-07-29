// Supabase 全表导出为 JSON（backup.ps1 调用；也可手动跑）
// 用法：node scripts/dump-supabase.mjs <输出目录>
// 免费档没有自动备份，每天 dump 一份进备份仓库就是我们的 PITR。
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./authCookie.mjs";

const outDir = process.argv[2];
if (!outDir) { console.error("用法：node scripts/dump-supabase.mjs <输出目录>"); process.exit(1); }

const env = readEnvLocal();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 与 supabase/schema.sql 的建表清单保持一致（新表记得同步加）
const TABLES = ["sources", "feed_items", "runs", "llm_calls", "publications", "monitor_topics", "briefings", "posts", "clips", "guides", "events"];
const PAGE = 1000;

mkdirSync(outDir, { recursive: true });

// 表在 schema.sql 里、但增量 SQL 还没在 Supabase 执行过——功能没上线而已，不算故障。
// 这种情况跳过并提醒，不该让整份备份失败。
const MISSING_TABLE = (e) => e.code === "PGRST205" || /Could not find the table/i.test(e.message ?? "");

let failed = false;
for (const table of TABLES) {
  const rows = [];
  let error = null;
  for (let from = 0; ; from += PAGE) {
    const res = await db.from(table).select("*").order("id").range(from, from + PAGE - 1);
    if (res.error) { error = res.error; break; }
    rows.push(...res.data);
    if (res.data.length < PAGE) break;
  }
  // 原来这里用的是共享的 failed 标志：一张表出错，它之后的所有表照样查却不再落盘，
  // 备份会静静地少掉半数表。错误必须按表隔离。
  if (error) {
    if (MISSING_TABLE(error)) {
      console.warn(`- ${table}: 表不存在，跳过（schema.sql 的增量段还没在 Supabase 执行）`);
    } else {
      console.error(`✗ ${table}: ${error.message}`);
      failed = true;
    }
    continue;
  }
  writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 1));
  console.log(`✓ ${table}: ${rows.length} 行`);
}
process.exit(failed ? 1 : 0);
