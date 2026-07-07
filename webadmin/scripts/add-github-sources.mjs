// 一次性脚本：把 GitHub 热门库源插入现有 Supabase（新装环境由 schema.sql 预置，无需此脚本）
// 用法：在 webadmin 目录执行  node scripts/add-github-sources.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const res = await fetch(`${url}/rest/v1/sources?on_conflict=feed_url`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=representation",
  },
  body: JSON.stringify([
    { track: "wechat", name: "GitHub 热门库（公众号）", feed_url: "https://github.com/trending?since=daily" },
    { track: "x", name: "GitHub 热门库（X）", feed_url: "https://github.com/trending?since=daily#x" },
  ]),
});

if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
const rows = await res.json();
console.log(rows.length > 0 ? `已插入 ${rows.length} 个源：${rows.map((r) => r.name).join("、")}` : "源已存在，跳过");
