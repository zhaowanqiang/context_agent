// 临时:答题→推荐卡→开户链接与教程页验证
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 1000, deviceScaleFactor: 1.3 });
await p.goto("http://localhost:3100/", { waitUntil: "networkidle2" });
// 答题:大陆护照 / 无地址 / 实体消费卡+加密出入金 / 只要简单的
for (const label of ["大陆护照", "无", "实体消费卡", "加密出入金", "只要简单的"]) {
  const el = await p.waitForSelector(`button ::-p-text(${label})`, { timeout: 5000 });
  await el.click();
}
await (await p.$("button ::-p-text(查看我的推荐)")).click();
await p.waitForSelector("::-p-text(给你的推荐)", { timeout: 5000 });
// 收集所有开户链接
const links = await p.evaluate(() =>
  [...document.querySelectorAll("a")]
    .filter((a) => a.textContent.includes("去开户") || a.textContent.includes("解锁逐步"))
    .map((a) => `${a.textContent.trim().slice(0, 14)} → ${a.href}`)
);
console.log(links.join("\n"));
const codes = await p.evaluate(() => [...document.querySelectorAll("code")].map((c) => c.textContent));
console.log("邀请码:", codes.join(", "));
await p.screenshot({ path: process.env.TEMP + "/decider-results.png" });
// 教程页
await p.goto("http://localhost:3100/guide/bybit-card", { waitUntil: "networkidle2" });
const guideOk = await p.evaluate(() => document.body.innerText.includes("国家选择是成败关键"));
console.log("bybit guide renders:", guideOk);
await p.screenshot({ path: process.env.TEMP + "/decider-guide.png" });
await b.close();
