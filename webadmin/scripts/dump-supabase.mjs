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
const TABLES = ["sources", "feed_items", "runs", "llm_calls", "publications", "monitor_topics", "briefings", "posts"];
const PAGE = 1000;

mkdirSync(outDir, { recursive: true });
let failed = false;
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").order("id").range(from, from + PAGE - 1);
    if (error) { console.error(`✗ ${table}: ${error.message}`); failed = true; break; }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  if (!failed) {
    writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 1));
    console.log(`✓ ${table}: ${rows.length} 行`);
  }
}
process.exit(failed ? 1 : 0);
