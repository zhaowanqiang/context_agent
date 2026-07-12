// 临时：发布中心 + 剪藏 + 周报三模块全链路验证（测试数据自建自删；周报留一期真实数据）
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer-core";
import { readEnvLocal, setAuthCookie } from "./authCookie.mjs";

const env = readEnvLocal();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const ok = (m, d = "") => { pass++; console.log(`✓ ${m}${d ? " — " + d : ""}`); };
const bad = (m, d = "") => { fail++; console.log(`✗ ${m}${d ? " — " + d : ""}`); };

// 0. schema 就位检查
for (const [name, q] of [
  ["runs.planned_publish_on", db.from("runs").select("planned_publish_on").limit(1)],
  ["publications.stats", db.from("publications").select("stats").limit(1)],
  ["clips 表", db.from("clips").select("id").limit(1)],
  ["briefings.kind", db.from("briefings").select("kind").limit(1)],
]) {
  const { error } = await q;
  if (error) bad(`schema: ${name}`, error.message); else ok(`schema: ${name}`);
}

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 950 });
page.on("dialog", (d) => d.accept());
const MARK = "SMOKE剪藏-勿动";

try {
  // 1. 剪藏 → 转素材 → 建 Run（X 轨，纯文字素材避开 200 字校验与外网抓取）
  const { data: clip } = await db.from("clips").insert({
    note: `${MARK}：Bybit 卡实测要点——格鲁吉亚区可绑微信支付宝，充值 USDT 到账 3 分钟，返现 2% 下月生效。`,
    track: "x",
  }).select("id").single();
  await page.goto(`${BASE}/clips`, { waitUntil: "networkidle2", timeout: 30000 });
  const seen = await page.evaluate((m) => document.body.innerText.includes(m), MARK);
  if (seen) ok("剪藏收件箱显示新剪藏"); else bad("剪藏收件箱显示");

  const [toRun] = await page.$$("button ::-p-text(转素材)");
  await toRun.click();
  await page.waitForFunction(() => location.pathname.includes("/runs/new"), { timeout: 20000 });
  await page.waitForSelector("textarea[name=material]");
  const material = await page.$eval("textarea[name=material]", (el) => el.value);
  if (material.includes(MARK)) ok("转素材：新建 Run 页预填剪藏内容"); else bad("转素材预填", material.slice(0, 60));

  await page.click("button[type=submit]");
  await page.waitForFunction(() => /\/agent\/x\/runs\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 20000 });
  const runId = await page.evaluate(() => location.pathname.split("/").pop());
  const { data: usedClip } = await db.from("clips").select("status, used_run_id").eq("id", clip.id).single();
  if (usedClip.status === "used" && usedClip.used_run_id === runId) ok("剪藏标记 used 并回链 run");
  else bad("剪藏 used 回链", JSON.stringify(usedClip));

  // 2. 发布队列排期：给刚建的 run 不适用（created 状态不进队列）——找一个 draft_review 的
  const { data: drRun } = await db.from("runs").select("id").eq("status", "draft_review").limit(1).maybeSingle();
  if (drRun) {
    await page.goto(`${BASE}/publish`, { waitUntil: "networkidle2" });
    const hasQueue = await page.evaluate(() => document.body.innerText.includes("发布队列"));
    if (hasQueue) ok("/publish 渲染（队列/命中率/回填三区）"); else bad("/publish 渲染");
    // 直接调 DB 验证排期字段可写（UI 的 date input 交互 puppeteer 兼容性差，改动作为 action 层验证）
    const { error: planErr } = await db.from("runs").update({ planned_publish_on: "2026-07-15" }).eq("id", drRun.id);
    await page.reload({ waitUntil: "networkidle2" });
    const dateShown = await page.$eval("input[type=date]", (el) => el.value).catch(() => "");
    if (!planErr && dateShown === "2026-07-15") ok("发布队列排期显示", dateShown);
    else bad("发布队列排期", `err=${planErr?.message} shown=${dateShown}`);
    await db.from("runs").update({ planned_publish_on: null }).eq("id", drRun.id);
  } else {
    console.log("（无 draft_review run，跳过队列排期检查）");
  }

  // 3. 效果回填：找一条 publication 填数字
  // 与 /publish 待回填区第一行保持同序（published_at desc）
  const { data: pub } = await db.from("publications").select("id").is("stats", null)
    .order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (pub) {
    await page.goto(`${BASE}/publish`, { waitUntil: "networkidle2" });
    const inputs = await page.$$("input[type=number]");
    if (inputs.length >= 2) {
      await inputs[0].type("1200");
      await inputs[1].type("45");
      const [saveBtn] = await page.$$("button ::-p-text(保存)");
      await saveBtn.click();
      await new Promise((r) => setTimeout(r, 2500));
      const { data: after } = await db.from("publications").select("stats").eq("id", pub.id).single();
      const vals = Object.values(after.stats ?? {});
      if (vals.includes(1200) && vals.includes(45)) ok("效果回填写入 stats", JSON.stringify(after.stats));
      else bad("效果回填", JSON.stringify(after.stats));
      // 命中率区应出现
      await page.reload({ waitUntil: "networkidle2" });
      const hasRate = await page.evaluate(() => document.body.innerText.includes("均值"));
      if (hasRate) ok("命中率看板出数"); else bad("命中率看板");
      await db.from("publications").update({ stats: null, stats_updated_at: null }).eq("id", pub.id);
    } else bad("效果回填", "找不到数字输入框");
  } else {
    console.log("（无待回填 publication，跳过）");
  }

  // 清理：测试 run + 剪藏
  await db.from("runs").delete().eq("id", runId);
  await db.from("clips").delete().eq("id", clip.id);
  console.log("测试数据已清理（run + 剪藏）");
} finally {
  await browser.close();
}

console.log(`\n结果：${pass} 过 / ${fail} 挂`);
process.exit(fail > 0 ? 1 : 0);
