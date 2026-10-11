// 公开层双主题截图：每个页面 × 浅色/夜间 × 桌面/手机宽度各一张。
// 用法：node scripts/shot-themes.mjs <outDir> [baseUrl] [themes=light,dark] [widths=1280,390]
//
// 主题通过 localStorage 注入（与站内切换按钮写的是同一个键），在页面脚本执行前就位，
// 所以截到的是「夜间模式用户刷新页面」的真实首屏，顺带验证防闪烁脚本。
// 输出同时打印每张图的 sha1：改造前后各跑一次浅色，哈希一致 = 浅色视觉逐像素没变。
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const outDir = process.argv[2] ?? "shots";
const base = (process.argv[3] ?? "http://localhost:3000").replace(/\/$/, "");
const themes = (process.argv[4] ?? "light,dark").split(",");
const widths = (process.argv[5] ?? "1280,390").split(",").map(Number);

/** [文件名, 路径]。带 hash 的是弹层展开态 */
// SHOT_ONLY=1 时只截 SHOT_EXTRA 里列的页面（逗号分隔的路径，可带 #hash）
const DEFAULT_PAGES = [
  ["home", "/"],
  ["about", "/about"],
  ["deals", "/deals"],
  ["on-x", "/on-x"],
  ["posts", "/posts"],
  ["post", process.env.SHOT_POST ?? "/posts/c01105a9"],
  ["cards", "/cards"],
  ["card-detail", "/cards#card-kast"],
  ["tutorials", "/tutorials"],
  ["tutorial-detail", "/tutorials#bitget"],
  ["notfound", "/posts/__nope__"],
];
const PAGES = [
  ...(process.env.SHOT_ONLY ? [] : DEFAULT_PAGES),
  ...(process.env.SHOT_EXTRA ?? "")
    .split(",")
    .filter(Boolean)
    // 路径可以不带开头的斜杠（Git Bash 会把以 / 开头的环境变量改写成 Windows 路径）
    .map((p) => [p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, ""), p.startsWith("/") ? p : `/${p}`]),
];

mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
});

for (const theme of themes) {
  for (const width of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    // 关掉动效：脉冲点、进场动画会让同一页面两次截图不一致
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {}
    }, theme);
    for (const [name, path] of PAGES) {
      await page.goto(base + path, { waitUntil: "networkidle2", timeout: 60000 });
      await page.addStyleTag({
        content:
          "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}nextjs-portal{display:none!important}" +
          // 与「加按钮之前」的基线比对浅色像素时，把切换按钮从布局里拿掉
          (process.env.SHOT_HIDE_TOGGLE ? "[data-theme-toggle]{display:none!important}" : ""),
      });
      await new Promise((r) => setTimeout(r, 500));
      const file = join(outDir, `${name}.${theme}.${width}.png`);
      // 弹层页只截视口（fixed 遮罩在整页截图里会错位）
      await page.screenshot({ path: file, fullPage: !path.includes("#") });
      const applied = await page.evaluate(() => document.documentElement.dataset.theme ?? "(none)");
      const sha = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 12);
      console.log(`${sha}  ${name}.${theme}.${width}  data-theme=${applied}`);
    }
    await page.close();
  }
}
await browser.close();
