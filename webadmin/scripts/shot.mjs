// 临时：桌面宽屏截图
import puppeteer from "puppeteer-core";
import { setAuthCookie } from "./authCookie.mjs";

const url = process.argv[2] ?? "http://localhost:3000/agent/wechat";
const out = process.argv[3] ?? "shot.png";
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 950, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
