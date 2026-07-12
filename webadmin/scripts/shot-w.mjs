// 临时：指定宽度截图（看排版细节用小宽度）。用法：node scripts/shot-w.mjs <url> <out> [width] [height]
import puppeteer from "puppeteer-core";
import { setAuthCookie } from "./authCookie.mjs";

const [url = "http://localhost:3000/", out = "shot.png", w = "1366", h = "900"] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
await setAuthCookie(browser);
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
