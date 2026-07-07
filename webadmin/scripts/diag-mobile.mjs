// 临时诊断：找出把手机布局撑宽的元素
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://127.0.0.1:3000/wechat";
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const wide = [];
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 1 || r.right > vw + 1) {
      wide.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className?.baseVal ?? el.className ?? "").toString().slice(0, 120),
        w: Math.round(r.width),
        right: Math.round(r.right),
        scrollW: el.scrollWidth,
        text: (el.textContent ?? "").trim().slice(0, 40),
      });
    }
  }
  return {
    vw,
    htmlScrollW: document.documentElement.scrollWidth,
    bodyW: Math.round(document.body.getBoundingClientRect().width),
    count: wide.length,
    // 只报最外层的几个 + 最宽的几个
    top: wide.slice(0, 12),
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
