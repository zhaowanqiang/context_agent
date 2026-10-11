// 主题切换行为回归：键盘切换 / 记忆 / 防闪烁 / 工作台锁浅色。用法：node scripts/test-theme.mjs [baseUrl]
import puppeteer from "puppeteer-core";
const B = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("[decider]")) errs.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 200)));
const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
const btn = () => page.evaluate(() => { const b = document.querySelector("[data-theme-toggle]"); return b ? { pressed: b.getAttribute("aria-pressed"), label: b.getAttribute("aria-label") } : null; });
await page.goto(B + "/", { waitUntil: "networkidle2" });
console.log("1 首次访问:", await theme(), JSON.stringify(await btn()));
await page.focus("[data-theme-toggle]"); await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 200));
console.log("2 键盘 Enter 切换后:", await theme(), JSON.stringify(await btn()), "stored=", await page.evaluate(() => localStorage.getItem("theme")));
// 刷新：在任何应用脚本执行前（DOMContentLoaded）检查属性，验证防闪烁脚本
await page.evaluateOnNewDocument(() => { document.addEventListener("DOMContentLoaded", () => { window.__atDCL = document.documentElement.dataset.theme; }); });
await page.reload({ waitUntil: "networkidle2" });
console.log("3 刷新后 DOMContentLoaded 时:", await page.evaluate(() => window.__atDCL), "| 水合后:", await theme(), JSON.stringify(await btn()));
// 客户端导航进工作台侧（/login 属于私有层路径）
await page.evaluate(() => { window.__nav = "same-document"; });
await page.click('a[href="/login"]'); await page.waitForFunction(() => location.pathname === "/login"); await new Promise((r) => setTimeout(r, 600));
console.log("4 客户端导航到 /login:", await theme(), "按钮=", JSON.stringify(await btn()), "软导航=", await page.evaluate(() => window.__nav === "same-document"), "stored=", await page.evaluate(() => localStorage.getItem("theme")));
await page.goBack(); await page.waitForFunction(() => location.pathname === "/"); await new Promise((r) => setTimeout(r, 600));
console.log("5 返回公开页:", await theme(), JSON.stringify(await btn()));
await page.goto(B + "/login", { waitUntil: "networkidle2" });
console.log("6 直接打开 /login（硬加载）:", await page.evaluate(() => window.__atDCL), await theme(), "按钮=", JSON.stringify(await btn()));
await page.goto(B + "/cards", { waitUntil: "networkidle2" });
await page.click("[data-theme-toggle]"); await new Promise((r) => setTimeout(r, 200));
console.log("7 再点一次切回:", await theme(), JSON.stringify(await btn()), "stored=", await page.evaluate(() => localStorage.getItem("theme")));
console.log("console errors:", errs.length ? errs : "none");
await browser.close();
