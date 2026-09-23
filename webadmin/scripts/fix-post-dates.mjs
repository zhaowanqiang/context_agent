// 一次性修正：批量回流时 posts.published_at 被写成回流当天（8 篇挤在同一天，像死站）。
// 改回 run 的平台首次发布时间（publications 最早一条），没有发布记录的用 run.updated_at。
// 用法：node scripts/fix-post-dates.mjs        # 预览
//       node scripts/fix-post-dates.mjs --apply # 实际写库
import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./authCookie.mjs";

const apply = process.argv.includes("--apply");
const env = readEnvLocal();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: posts, error } = await db
  .from("posts")
  .select("id, run_id, slug, title, published_at")
  .not("run_id", "is", null);
if (error) { console.error(`✗ 读 posts 失败：${error.message}`); process.exit(1); }

let changed = 0;
for (const post of posts) {
  const { data: pub } = await db
    .from("publications")
    .select("published_at")
    .eq("run_id", post.run_id)
    .order("published_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let target = pub?.published_at;
  if (!target) {
    const { data: run } = await db.from("runs").select("updated_at").eq("id", post.run_id).maybeSingle();
    target = run?.updated_at;
  }
  if (!target) { console.log(`- ${post.slug} 找不到发布时间，跳过`); continue; }
  const same = new Date(target).getTime() === new Date(post.published_at).getTime();
  if (same) { console.log(`= ${post.slug} 已一致（${target}）`); continue; }
  console.log(`${apply ? "✓" : "→"} ${post.slug} ${post.published_at} → ${target}  ${post.title.slice(0, 24)}`);
  changed++;
  if (apply) {
    const { error: upErr } = await db.from("posts").update({ published_at: target }).eq("id", post.id);
    if (upErr) { console.error(`✗ ${post.slug} 更新失败：${upErr.message}`); process.exit(1); }
  }
}
console.log(apply ? `完成：更新 ${changed} 篇` : `预览：将更新 ${changed} 篇（加 --apply 执行）`);
