// 教程导航行为回归：hash 深链 / 隐藏分类回落 / 搜索 / 详情展开与关闭 / 相关推荐 / 复制 / 外链 rel。
// 用法：node scripts/test-tutorials.mjs [baseUrl]   （有断言失败时退出码 1）
import puppeteer from "puppeteer-core";

const B = (process.argv[2] ?? "http://localhost:3000").replace(/[/]$/, "");
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
});
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(new URL(B).origin, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]);
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
const errs = [];
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("[decider]")) errs.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 200)));

let failed = 0;
function check(name, ok, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "  ok " : " FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 160) : ""}`);
}
const settle = () => new Promise((r) => setTimeout(r, 350));
const cardCount = () => page.$$eval("li > h3 > button[aria-haspopup=dialog]", (b) => b.length);
const dialogTitle = () => page.$eval("[role=dialog] h2", (h) => h.textContent).catch(() => null);
const pressed = () =>
  page.$$eval("nav[aria-label=教程分类] button[aria-pressed=true]", (b) => b.map((x) => x.textContent.replace(/\d+$/, "").trim()));
const go = async (hash) => {
  await page.goto("about:blank");
  await page.goto(`${B}/tutorials${hash}`, { waitUntil: "networkidle2" });
  await settle();
};

// 1. 总览
await go("");
const total = await cardCount();
const tabs = await page.$$eval("nav[aria-label=教程分类] button", (b) => b.map((x) => x.textContent));
check("总览渲染全部可见教程", total === 31, `${total} 张卡片`);
check("入口 = 全部 + 4 个分类，没有网络工具", tabs.length === 5 && !tabs.some((t) => t.includes("网络")), tabs.join(" | "));

// 2. 分类深链
await go("#crypto-card");
check("#crypto-card 只显示 U 卡分类", (await cardCount()) === 6 && (await pressed()).join() .includes("U卡"), `${await cardCount()} 张`);

// 3. 教程深链
await go("#bitget");
check("#bitget 直接展开详情", (await dialogTitle()) === "Bitget Wallet U 卡", String(await dialogTitle()));
const rels = await page.$$eval("[role=dialog] a[target=_blank]", (as) => as.map((a) => [a.textContent.trim().slice(0, 12), a.rel]));
check(
  "注册链接 rel 带 sponsored，Telegram 链接不带",
  rels.filter(([t]) => t.includes("注册")).every(([, r]) => r === "sponsored nofollow noopener noreferrer") &&
    rels.filter(([t]) => t.includes("Telegram")).every(([, r]) => r === "noopener noreferrer"),
  JSON.stringify(rels)
);
const tg = await page.$$eval("[role=dialog] a", (as) => as.find((a) => a.textContent.includes("Telegram"))?.href);
check("「在 Telegram 获取」用 telegramDeepLink", tg === "https://t.me/zynqorw_bot?start=bitget", tg);

// 4. 复制邀请码（无头浏览器里剪贴板要求页面在前台）
await page.bringToFront();
await page.click("[role=dialog] button[aria-label^=复制邀请码]");
await settle();
const clip = await page.evaluate(() => navigator.clipboard.readText());
const live = await page.$$eval("[role=dialog] [aria-live=polite]", (s) => s.map((x) => x.textContent).join(""));
check("点复制写入剪贴板并播报「已复制」", clip === "BDe5Rn8m" && live.includes("已复制"), `${clip} / ${live}`);

// 5. 相关推荐 → 切到另一篇；关闭 → 停在该教程所在分类
const before = await page.evaluate(() => history.length);
await page.evaluate(() => [...document.querySelectorAll("[role=dialog] button")].find((b) => b.textContent.trim() === "U 卡汇总").click());
await settle();
check("点相关推荐切到对应详情并更新 hash", (await dialogTitle()) === "U 卡汇总" && (await page.evaluate(() => location.hash)) === "#ucard");
check("相关推荐不新增历史记录", (await page.evaluate(() => history.length)) === before);
await page.keyboard.press("Escape");
await settle();
check(
  "Esc 关闭后停在所属分类（直链进入，没有可退的上一步）",
  (await dialogTitle()) === null && (await page.evaluate(() => location.hash)) === "#crypto-card",
  await page.evaluate(() => location.hash)
);

// 6. 从列表打开 → 浏览器后退 = 关闭
await go("#exchange");
// 用键盘打开：先聚焦再回车，才有「关闭后焦点归位」可验
await page.evaluate(() => [...document.querySelectorAll("li > h3 > button")].find((b) => b.textContent.trim() === "欧易 OKX").focus());
await page.keyboard.press("Enter");
await settle();
check("从分类里点卡片展开详情", (await dialogTitle()) === "欧易 OKX" && (await page.evaluate(() => location.hash)) === "#okx");
check("详情展开时背后仍是原分类", (await cardCount()) === 6);
await page.goBack();
await settle();
check("浏览器后退 = 关闭面板，回到原分类", (await dialogTitle()) === null && (await page.evaluate(() => location.hash)) === "#exchange");
const focusBack = await page.evaluate(() => (document.activeElement?.tagName === "BUTTON" ? document.activeElement.textContent.trim() : document.activeElement?.tagName));
check("关闭后焦点回到原卡片", focusBack === "欧易 OKX", String(focusBack));

// 7. 隐藏分类的 hash 回落到总览
for (const h of ["#network", "#vps", "#vpn", "#does-not-exist"]) {
  await go(h);
  check(`${h} 回落到总览`, (await cardCount()) === 31 && (await dialogTitle()) === null);
}
const html = await page.content();
check("页面里没有隐藏分类的任何内容", !/racknerd|bandwagon|muguacloud|984420|网络工具/i.test(html));

// 8. 相关推荐里过滤掉隐藏分类（maya 的 related 含 esim 等，vps 的教程不该出现）
await go("#smarty");
const related = await page.$$eval("[role=dialog] ul button", (b) => b.map((x) => x.textContent.trim()));
check("相关推荐 2~3 条且都是可见教程", related.length >= 1 && related.length <= 3 && !related.some((r) => /VPS|节点/.test(r)), related.join(" | "));
const xesim = await page.$$eval("[role=dialog] aside", (a) => a.length);
check("手机号教程详情里共用推荐位只出现一次", xesim === 1);

// 9. 搜索：按名称、按触发词、搜不到隐藏教程
await go("");
await page.type("#tutorial-search", "wise");
await settle();
check("按名称搜索 wise", (await cardCount()) === 1);
await page.$eval("#tutorial-search", (i) => (i.value = ""));
await page.type("#tutorial-search", "万里汇");
await settle();
check("按触发词搜索 万里汇", (await cardCount()) === 1);
for (const q of ["vps", "机场", "racknerd"]) {
  await page.click("#tutorial-search", { clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.type("#tutorial-search", q);
  await settle();
  check(`搜不到隐藏分类的「${q}」`, (await cardCount()) === 0);
}

// 10. 分类页共用推荐位只渲染一次；/numbers 重定向；/cards 互链
await go("#phone-number");
check("手机号分类末尾共用推荐位只出现一次", (await page.$$eval("main aside", (a) => a.length)) === 1);
const res = await page.goto(`${B}/numbers`, { waitUntil: "networkidle2" });
await settle();
check("/numbers → /tutorials#phone-number", page.url().endsWith("/tutorials#phone-number") && (await cardCount()) === 7, page.url());
await page.goto("about:blank");
await page.goto(`${B}/cards#card-bitget-wallet`, { waitUntil: "networkidle2" });
await settle();
const cardCodes = await page.$$eval("[role=dialog] input[aria-label=邀请码]", (i) => i.map((x) => x.value));
const cardLink = await page.$$eval("[role=dialog] a", (as) => as.find((a) => a.getAttribute("href")?.startsWith("/tutorials#"))?.getAttribute("href"));
check("/cards 的 Bitget Wallet 带出两张卡的邀请码并链回教程", cardCodes.join() === "BDe5Rn8m,AQ6EZ8yc" && cardLink === "/tutorials#bitget", `${cardCodes} ${cardLink}`);

check("控制台无报错", errs.length === 0, errs.join(" || "));
void res;
await browser.close();
if (failed > 0) {
  console.error(`\n${failed} 项失败`);
  process.exit(1);
}
console.log("\n全部通过");
