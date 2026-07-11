// 临时：真实点击「立即生成简报」跑全链路（Google News 检索 → DeepSeek → 入库 → 页面渲染）
import puppeteer from "puppeteer-core";
import { setAuthCookie } from "./authCookie.mjs";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1100 });
page.on("console", (m) => { if (m.type() === "error") console.log("[browser]", m.text()); });

await page.goto("http://localhost:3000/monitor", { waitUntil: "networkidle2", timeout: 30000 });

// 点按钮
const btn = await page.waitForSelector("button ::-p-text(立即生成简报)", { timeout: 10000 });
await btn.click();
console.log("clicked, waiting (max 6min)…");

// 等结果消息出现（成功：检索 N 次…；失败：红字错误）
await page.waitForFunction(
  () => {
    const ps = [...document.querySelectorAll("p")];
    return ps.some((p) => /检索 \d+ 次|失败|超时|错误/.test(p.textContent ?? ""));
  },
  { timeout: 360000, polling: 2000 }
);
const result = await page.evaluate(() => {
  const ps = [...document.querySelectorAll("p")];
  return ps.find((p) => /检索 \d+ 次|失败|超时|错误/.test(p.textContent ?? ""))?.textContent;
});
console.log("result:", result);

await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: process.env.TEMP + "\\briefing-run.png" });
await browser.close();
console.log("screenshot saved");
