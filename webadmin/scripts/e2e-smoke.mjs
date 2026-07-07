// E2E 冒烟测试：真实浏览器点击全流程（测试数据自建自删，不污染正式数据）
// 用法：node scripts/e2e-smoke.mjs [--llm]   （--llm 会真的调一次 DeepSeek 出大纲，约 ¥0.03）
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:3000";
const WITH_LLM = process.argv.includes("--llm");
const MARK = "[E2E-TEST]";

// ── env ──────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf-8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2];
}
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
const ok = (name, detail = "") => { results.push({ name, ok: true, detail }); console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`); };
const bad = (name, detail = "") => { results.push({ name, ok: false, detail }); console.log(`✗ ${name}${detail ? ` — ${detail}` : ""}`); };

// ── 测试数据 ─────────────────────────────────────────────────────────
const { data: src } = await db.from("sources").select("id").eq("track", "wechat").limit(1).single();
if (!src) { console.error("没有 wechat 源，无法建测试 feed_item"); process.exit(1); }

const { data: item, error: itemErr } = await db.from("feed_items").insert({
  source_id: src.id, track: "wechat", guid: `e2e-${Date.now()}`,
  title: `${MARK} 冒烟测试选题（自动清理）`, link: "https://example.com/e2e",
  summary: "E2E 测试条目", status: "scored", score: 9.9,
  suggested_angle: "测试角度", score_reason: "测试",
}).select("id").single();
if (itemErr) { console.error("建测试 feed_item 失败：", itemErr.message); process.exit(1); }

const material = `${MARK} 这是端到端冒烟测试素材。实测了一个假想工具 FooBar CLI：安装一条命令，跑通耗时 3 分钟，输出结果准确。注意事项：Windows 下要先装依赖。`;
const { data: runAbort } = await db.from("runs").insert({ track: "x", status: "created", material }).select("id").single();
let runPubId = null; // 范例库闭环测试的 run（在 try 里创建，finally 里清理）
const createdRunIds = []; // 表单提交测试创建的 run
const { data: runLlm } = WITH_LLM
  ? await db.from("runs").insert({ track: "x", status: "created", material }).select("id").single()
  : { data: null };

// ── 浏览器 ───────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`console: ${m.text()}`); });
page.on("requestfailed", (r) => {
  const f = r.failure()?.errorText ?? "";
  if (!f.includes("ERR_ABORTED")) consoleErrors.push(`requestfailed: ${r.url()} ${f}`);
});

const clickByText = async (text, tag = "button") => {
  const sel = `${tag}::-p-text(${text})`;
  await page.waitForSelector(sel, { timeout: 10000 });
  await page.click(sel);
};
// 行内按钮：MARK 含 [] 会被 ::-p-text 解析成属性选择器，走 DOM 查找
const clickRowButton = async (rowText, btnText) => {
  const found = await page.evaluate(
    (rt, bt) => {
      const row = [...document.querySelectorAll("li")].find((li) => li.innerText.includes(rt));
      const btn = row && [...row.querySelectorAll("button")].find((b) => b.innerText.includes(bt));
      if (btn) { btn.click(); return true; }
      return false;
    },
    rowText, btnText
  );
  if (!found) throw new Error(`行「${rowText}」里找不到按钮「${btnText}」`);
};
const waitRowButton = (rowText, btnText, timeout = 5000) =>
  page.waitForFunction(
    (rt, bt) => {
      const row = [...document.querySelectorAll("li")].find((li) => li.innerText.includes(rt));
      return !!row && [...row.querySelectorAll("button")].some((b) => b.innerText.includes(bt));
    },
    { timeout },
    rowText, btnText
  );
const waitText = (text, timeout = 15000) =>
  page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);

try {
  // 1. 首页 → 进入公众号轨
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 });
  await waitText("选择平台");
  ok("首页渲染");
  await clickByText("公众号", "a h2");
  await waitText("仪表盘");
  ok("首页 → 公众号仪表盘");

  // 2. 轨道内导航计时（首访 vs 30s 内重访，验证客户端缓存）
  const navTo = async (label, expect) => {
    const t0 = Date.now();
    await page.click(`nav a::-p-text(${label})`);
    await waitText(expect);
    return Date.now() - t0;
  };
  const t1 = await navTo("选题池", "选题池 ·");
  const t2 = await navTo("Runs", "Runs ·");
  const t3 = await navTo("内容源", "内容源 ·");
  const t4 = await navTo("选题池", "选题池 ·"); // 重访：应走客户端缓存
  const t5 = await navTo("Runs", "Runs ·");     // 重访
  ok("轨道内导航", `首访 选题池${t1}ms/Runs${t2}ms/内容源${t3}ms → 重访 选题池${t4}ms/Runs${t5}ms`);
  if (t4 > Math.max(400, t1) || t5 > Math.max(400, t2)) bad("客户端缓存生效性", `重访没有明显变快：${t4}ms/${t5}ms`);
  else ok("客户端缓存生效（30s 内重访显著变快）");

  // 3. 选题操作：入候选（乐观更新）→ 持久化 → 丢弃
  await page.goto(`${BASE}/wechat/topics`, { waitUntil: "networkidle2" });
  await waitText(MARK);
  const tOpt = Date.now();
  await clickRowButton(MARK, "入候选");
  await waitRowButton(MARK, "开始创作");
  ok("入候选点击响应（乐观更新）", `${Date.now() - tOpt}ms 出现「开始创作」`);
  // 等服务端写完再验证持久化
  await new Promise((r) => setTimeout(r, 2500));
  const { data: after } = await db.from("feed_items").select("status").eq("id", item.id).single();
  if (after?.status === "shortlisted") ok("入候选已持久化"); else bad("入候选持久化", `status=${after?.status}`);
  // 候选 tab 里能看到
  await page.goto(`${BASE}/wechat/topics?status=shortlisted`, { waitUntil: "networkidle2" });
  await waitText(MARK);
  ok("候选 tab 显示新候选");
  // 丢弃
  await clickRowButton(MARK, "丢弃");
  await new Promise((r) => setTimeout(r, 2500));
  const { data: after2 } = await db.from("feed_items").select("status").eq("id", item.id).single();
  if (after2?.status === "discarded") ok("丢弃已持久化"); else bad("丢弃持久化", `status=${after2?.status}`);

  // 4. 开始创作按钮 → 新建 Run 页（带 feed_item 种子）
  await db.from("feed_items").update({ status: "shortlisted" }).eq("id", item.id);
  await page.goto(`${BASE}/wechat/topics?status=shortlisted`, { waitUntil: "networkidle2" });
  await waitText(MARK);
  await clickRowButton(MARK, "开始创作");
  // 注意：每页导航栏都有「+ 新建 Run」按钮，不能用文字等页面，直接等表单出现
  await page.waitForSelector("textarea[name=material]", { timeout: 30000 });
  const seedVal = await page.$eval("textarea[name=material]", (el) => el.value);
  if (seedVal.includes(MARK)) ok("开始创作 → 新建页种子素材注入"); else bad("新建页种子素材", "textarea 里没有选题标题");

  // 5. Run 工作台：素材展示 + 放弃
  await page.goto(`${BASE}/x/runs/${runAbort.id}`, { waitUntil: "networkidle2" });
  await waitText(MARK);
  ok("Run 详情页渲染（素材可见）");
  await clickByText("放弃");
  await waitText("本次运行已放弃", 15000);
  ok("放弃 run → 状态流转 aborted");

  // 5b. 新建 Run 表单提交 → 服务端 redirect 到 run 详情页
  await page.goto(`${BASE}/x/runs/new`, { waitUntil: "networkidle2" });
  await page.waitForSelector("textarea[name=material]");
  await page.type("textarea[name=material]", `${MARK} 表单提交测试素材：实测某工具跑通，步骤三条，结论一行。`);
  await page.click("button[type=submit]");
  await page.waitForFunction(() => /\/x\/runs\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 20000 });
  createdRunIds.push(await page.evaluate(() => location.pathname.split("/").pop()));
  ok("新建 Run 表单 → redirect 到 run 页");

  // 6. 范例库闭环：发布 → 自动喂回 → 范例库页可见 → 删除
  page.on("dialog", (d) => d.accept()); // FewshotRowActions 的 confirm()
  const { data: runPub } = await db.from("runs").insert({
    track: "x", status: "draft_review", material,
    title: `${MARK}fewshot`, draft: "E2E 成稿", draft_final: `${MARK} 这是喂库测试终稿。要点一：跑通。要点二：清理。`,
    checklist: "【质量自检】9.0/10\n- 无明显问题\n\n---\n\n红线检查：通过",
  }).select("id").single();
  runPubId = runPub.id;
  await page.goto(`${BASE}/x/runs/${runPub.id}`, { waitUntil: "networkidle2" });
  await clickByText("标记已发布");
  await waitText("已在范例库", 20000);
  ok("标记发布 → 自动喂回范例库（按钮变 ✓ 状态）");
  await page.goto(`${BASE}/x/fewshot`, { waitUntil: "networkidle2" });
  await waitText("few-shot 范例库");
  await waitText("成稿质检分走势");
  ok("范例库页渲染（走势图 + 条目列表）");
  await waitText(MARK); // 刚喂回的条目在列表里
  ok("新喂回的范例出现在库列表");
  await clickRowButton(MARK, "删除");
  try {
    await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout: 10000 }, MARK);
    ok("删除范例 → 列表即时移除");
  } catch (e) {
    const dump = await page.evaluate((t) =>
      [...document.querySelectorAll("li,span,p")]
        .filter((el) => el.children.length === 0 && el.innerText?.includes(t))
        .map((el) => `${el.tagName}: ${el.innerText.slice(0, 120)}`)
        .slice(0, 5),
      MARK
    );
    bad("删除范例 → 列表即时移除", `超时。MARK 残留在：${JSON.stringify(dump)}`);
  }

  // 7.（可选）真 LLM：分步出大纲，验证 Next→FastAPI→DeepSeek 全链路
  if (WITH_LLM && runLlm) {
    await page.goto(`${BASE}/x/runs/${runLlm.id}`, { waitUntil: "networkidle2" });
    await clickByText("分步走：先出大纲让我改");
    console.log("… LLM 出大纲中（最长等 4 分钟）");
    await waitText("大纲 · 人工闸口", 240000);
    ok("LLM 全链路（outline 生成 → outline_review）");
    await clickByText("放弃");
    await waitText("本次运行已放弃", 15000);
  }

  // 8. 无效轨道 404 页
  await page.goto(`${BASE}/bogus`, { waitUntil: "networkidle2" });
  const notFound = await page.evaluate(() => document.body.innerText.includes("404") || document.body.innerText.includes("not be found"));
  if (notFound) ok("无效轨道渲染 404 页"); else bad("无效轨道", "没有渲染 404 内容");
} catch (e) {
  bad("流程中断", e.message);
  try { console.log("URL:", page.url()); } catch {}
} finally {
  await browser.close();
  // ── 清理测试数据 ───────────────────────────────────────────────────
  await db.from("feed_items").delete().eq("id", item.id);
  await db.from("runs").delete().eq("id", runAbort.id);
  if (runLlm) await db.from("runs").delete().eq("id", runLlm.id);
  for (const id of createdRunIds) await db.from("runs").delete().eq("id", id);
  if (runPubId) {
    await db.from("runs").delete().eq("id", runPubId); // publications 级联删除
    // 中途失败时喂库文件可能还在，兜底清掉
    const dir = new URL("../../tracks/x/fewshot/", import.meta.url);
    try {
      const { readdirSync, unlinkSync } = await import("node:fs");
      for (const f of readdirSync(dir)) if (f.includes(runPubId.slice(0, 8))) unlinkSync(new URL(f, dir));
    } catch { /* 目录不存在等 */ }
  }
  console.log("\n测试数据已清理");
}

if (consoleErrors.length) {
  console.log("\n浏览器错误：");
  for (const e of [...new Set(consoleErrors)]) console.log("  " + e.slice(0, 200));
} else {
  console.log("\n浏览器 0 报错");
}
const failed = results.filter((r) => !r.ok);
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
