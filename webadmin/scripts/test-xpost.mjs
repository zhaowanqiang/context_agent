// 临时：真实点击简报条目的「生成 X 帖」跑全链路（xpost → gate → X 轨 run）
import puppeteer from "puppeteer-core";
import { setAuthCookie } from "./authCookie.mjs";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  protocolTimeout: 420000, // LLM 全程可能超过 CDP 默认 180s
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1200 });

await page.goto("http://localhost:3000/monitor", { waitUntil: "networkidle2", timeout: 30000 });

// 面板存在性
const panelText = await page.evaluate(() => document.body.innerText.includes("选题转 X 帖"));
console.log("panel present:", panelText);

// 点第 2 个条目（KAST ToS 争议）的按钮
const buttons = await page.$$("button ::-p-text(生成 X 帖)");
console.log("buttons:", buttons.length);
await buttons[1].click();
console.log("clicked item #2, waiting…");

await page.waitForFunction(
  () => {
    const t = document.body.innerText;
    return t.includes("查看草稿") || /解析失败|失败：|超时|HTTP \d/.test(t);
  },
  { timeout: 360000, polling: 3000 }
);
const ok = await page.evaluate(() => document.body.innerText.includes("查看草稿"));
console.log(ok ? "SUCCESS: run created" : "FAILED, see screenshot");
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: process.env.TEMP + "\\xpost-run.png" });
await browser.close();
