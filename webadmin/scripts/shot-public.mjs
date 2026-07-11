// 临时：访客视角截图（不带登录 cookie）。用法：node scripts/shot-public.mjs <url> <out.png> [width]
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:3000/";
const out = process.argv[3] ?? "shot-public.png";
const width = Number(process.argv[4] ?? 1920);
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width, height: 1100, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log("saved", out);
