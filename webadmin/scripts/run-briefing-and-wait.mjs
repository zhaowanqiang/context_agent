// 临时：触发一次简报产线并等它落库（绕开 puppeteer protocolTimeout 撑不住全场的坑——
// 点击交给 puppeteer，落库轮询走 DB）。用法：node scripts/run-briefing-and-wait.mjs
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";
import { readEnvLocal, setAuthCookie } from "./authCookie.mjs";

const env = readEnvLocal();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: before } = await db.from("briefings").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
const beforeId = before?.id ?? null;

// 点按钮触发（不等完成，30s 后直接放掉浏览器）
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.goto("http://localhost:3000/monitor", { waitUntil: "networkidle2", timeout: 30000 });
const [btn] = await page.$$("button ::-p-text(立即生成简报)");
if (!btn) throw new Error("找不到生成按钮");
await btn.click();
console.log("已触发，等待落库…");
await new Promise((r) => setTimeout(r, 5000)); // 等 server action 确认收到
await browser.close(); // 注意：server action 在服务端继续跑，浏览器关了不影响

// 轮询 DB（最长 8 分钟）
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15_000));
  const { data } = await db.from("briefings").select("id, title, item_count, body_md").order("created_at", { ascending: false }).limit(1).single();
  if (data.id !== beforeId) {
    console.log("新简报落库:", data.title, "| 条目:", data.item_count, "| id:", data.id);
    console.log("====== 正文 ======");
    console.log(data.body_md);
    process.exit(0);
  }
  process.stdout.write(".");
}
console.log("\n超时：8 分钟内没有新简报落库");
process.exit(1);
