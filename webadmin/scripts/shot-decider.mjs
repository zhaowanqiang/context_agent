import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1500, height: 1050, deviceScaleFactor: 1.3 });
await p.goto("http://localhost:3100/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 600));
await p.screenshot({ path: process.env.TEMP + "/d3-hero.png" });
for (const label of ["大陆护照", "无", "加密出入金", "实体消费卡", "只要简单的"]) {
  await (await p.waitForSelector(`button ::-p-text(${label})`, { timeout: 5000 })).click();
}
await (await p.$("button ::-p-text(查看我的推荐)")).click();
await new Promise((r) => setTimeout(r, 900));
await p.screenshot({ path: process.env.TEMP + "/d3-results.png" });
await b.close();
console.log("ok");
