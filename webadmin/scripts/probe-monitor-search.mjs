// 临时：监控检索探针——不进 LLM，只看各源对每个话题的原始返回/新鲜/命中数量。
// 用法：node scripts/probe-monitor-search.mjs "Bybit Card"（不带参数跑全部话题的 GoogleNews）
import Parser from "rss-parser";
import { createClient } from "@supabase/supabase-js";
import { readEnvLocal } from "./authCookie.mjs";

const env = readEnvLocal();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const parser = new Parser();
const FRESH_MS = 48 * 3600_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function curlProxy(url) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)("curl", ["-sS", "-L", "-m", "30", "-x", env.AGENT_FETCH_PROXY, "-A", UA, url], { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

const { data: topics } = await db.from("monitor_topics").select("*").eq("enabled", true).order("position");
const filter = process.argv[2];
for (const t of topics) {
  if (filter && t.name !== filter) continue;
  const variants = (t.keywords ?? t.name).split("/").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const en = variants.filter((v) => !/[一-鿿]/.test(v));
  console.log(`\n===== ${t.name} | 变体: ${variants.join(" || ")}`);
  // GoogleNews 第一个英文变体
  const q = en[0] ?? variants[0];
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await curlProxy(url);
    const feed = await parser.parseString(xml);
    const items = feed.items ?? [];
    const fresh = items.filter((i) => i.isoDate && Date.now() - new Date(i.isoDate).getTime() <= FRESH_MS);
    console.log(`GoogleNews(${q}): 返回 ${items.length} 条，48h 内 ${fresh.length} 条`);
    for (const i of fresh.slice(0, 5)) console.log(`  - [${i.isoDate}] ${i.title}`);
    if (fresh.length === 0 && items.length > 0) {
      for (const i of items.slice(0, 3)) console.log(`  (超窗) [${i.isoDate}] ${i.title}`);
    }
  } catch (e) {
    console.log(`GoogleNews(${q}): 失败 ${e.message.split("\n")[0]}`);
  }
  await new Promise((r) => setTimeout(r, 1200));
}
