// 临时验证脚本：posts 表是否已建 + 可回流的 published run 候选
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf-8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const posts = await db.from("posts").select("id, slug, title, run_id").limit(5);
if (posts.error) {
  console.log("posts 表：❌", posts.error.message);
  process.exit(1);
}
console.log(`posts 表：✓ 已建（现有 ${posts.data.length} 行）`);
for (const p of posts.data) console.log(`  - /posts/${p.slug} ${p.title}`);

const runs = await db
  .from("runs")
  .select("id, track, title, status, draft_final, draft")
  .eq("status", "published")
  .order("updated_at", { ascending: false })
  .limit(5);
if (runs.error) throw new Error(runs.error.message);
console.log(`\npublished runs 候选（${runs.data.length}）：`);
for (const r of runs.data)
  console.log(
    `  ${r.id.slice(0, 8)} [${r.track}] ${r.title ?? "（无标题）"} 终稿:${r.draft_final ? "有" : "无"} 草稿:${r.draft ? "有" : "无"}`
  );
