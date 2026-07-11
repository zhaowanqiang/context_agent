import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 1100, deviceScaleFactor: 1.3 });
await p.goto("http://localhost:3100/", { waitUntil: "networkidle2" });
for (const label of ["大陆护照", "无", "美股券商", "加密出入金", "只要简单的"]) {
  await (await p.waitForSelector(`button ::-p-text(${label})`, { timeout: 5000 })).click();
}
await (await p.$("button ::-p-text(查看我的推荐)")).click();
await p.waitForSelector("::-p-text(给你的推荐)", { timeout: 5000 });
const first = await p.evaluate(() => document.querySelector("h4")?.textContent);
console.log("第一推荐:", first);
await p.screenshot({ path: process.env.TEMP + "/d2-results.png" });
// 点第一个「看开卡教程」
await (await p.$("a ::-p-text(看开卡教程)")).click();
await p.waitForSelector(".md-body", { timeout: 10000 });
console.log("教程页 url:", p.url());
await new Promise((r) => setTimeout(r, 600));
await p.screenshot({ path: process.env.TEMP + "/d2-guide.png", fullPage: true });
await b.close();
console.log("done");
