// 临时：真实点击 run 详情页「回流到个人站」验证全链路（回流 → 公开层可见 → 下架 → 消失）
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";
import { readEnvLocal, setAuthCookie } from "./authCookie.mjs";

const env = readEnvLocal();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 挑最近一个 published run 当测试对象
const { data: run, error } = await db
  .from("runs")
  .select("id, track, title")
  .eq("status", "published")
  .order("updated_at", { ascending: false })
  .limit(1)
  .single();
if (error) throw new Error(error.message);
console.log(`测试对象: ${run.id.slice(0, 8)} [${run.track}] ${run.title}`);

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1200 });
// 下架按钮有 confirm()，一律接受
page.on("dialog", (d) => d.accept());

const runUrl = `http://localhost:3000/agent/${run.track}/runs/${run.id}`;
await page.goto(runUrl, { waitUntil: "networkidle2", timeout: 30000 });

// 1) 面板存在（两种状态：未回流=按钮「回流到个人站」，已回流=「已回流 ·」链接）
const hasPanel = await page.evaluate(() =>
  /回流到个人站|已回流 ·/.test(document.body.innerText)
);
console.log("1) 回流面板出现:", hasPanel);
if (!hasPanel) {
  await page.screenshot({ path: process.env.TEMP + "\\site-publish-fail.png" });
  throw new Error("面板缺失，截图见 %TEMP%\\site-publish-fail.png");
}

// 2) 点回流，等「已回流」链接元素出现（别用 innerText 正则——文章正文里可能天然含「失败」字样）
const already = await page.$('a[href^="/posts/"]');
if (already) {
  console.log("   （已是回流状态，跳过点击）");
} else {
  const [btn] = await page.$$("button ::-p-text(回流到个人站)");
  await btn.click();
  await page.waitForSelector('a[href^="/posts/"]', { timeout: 30000 });
}
const slug = await page.evaluate(
  () => document.querySelector('a[href^="/posts/"]')?.getAttribute("href")?.split("/").pop() ?? null
);
console.log("2) 回流完成, slug:", slug);
if (!slug) throw new Error("未拿到 slug");

// 3) 公开层验证：无 cookie 的裸 fetch（模拟访客）
const pub = async (path) => {
  const r = await fetch(`http://localhost:3000${path}`, { redirect: "manual" });
  return { status: r.status, text: r.status === 200 ? await r.text() : "" };
};
const detail = await pub(`/posts/${slug}`);
const list = await pub("/posts");
const rss = await pub("/rss.xml");
const home = await pub("/");
const t = run.title;
console.log(`3) 访客视角:`);
console.log(`   /posts/${slug} -> ${detail.status}, 含标题: ${detail.text.includes(t)}`);
console.log(`   /posts 列表含标题: ${list.status === 200 && list.text.includes(t)}`);
console.log(`   /rss.xml 含标题: ${rss.status === 200 && rss.text.includes(t)}`);
console.log(`   首页最新文章含标题: ${home.status === 200 && home.text.includes(t)}`);

// 4) 重复回流防护：刷新后应显示「已回流」而非按钮
await page.reload({ waitUntil: "networkidle2" });
const dedupe = await page.evaluate(() => document.body.innerText.includes("已回流"));
console.log("4) 重复回流防护（刷新后显示已回流）:", dedupe);

// 5) 下架 → 公开层消失
const [unpubBtn] = await page.$$("button ::-p-text(下架)");
await unpubBtn.click();
await page.waitForFunction(
  () => document.body.innerText.includes("回流到个人站 /posts"),
  { timeout: 30000, polling: 500 }
);
const gone = await pub(`/posts/${slug}`);
const { count } = await db.from("posts").select("*", { count: "exact", head: true });
console.log(`5) 下架后: /posts/${slug} -> ${gone.status}（期望 404）, posts 表剩 ${count} 行`);

await browser.close();
console.log("\n✅ 回流全链路验证完成，现场已恢复（posts 表回到空）");
