// 构建期闸门：公开数据/页面里残留占位内容就让构建失败（package.json 的 prebuild 调用）。
//
// 起因：data/x-articles.ts、data/phone-numbers.ts 的 SAMPLE 条目和首页二维码
// PLACEHOLDER 框曾随 git push 直接上了生产——这个站的卖点是「没核实的不写」，
// 占位内容上线等于自己拆台。
//
// 只查「会渲染出去的文本」：先剥掉注释再匹配，注释里写 PLACEHOLDER/SAMPLE 说明不算。
// 标识符（NOTES_PLACEHOLDER、input 的 placeholder 属性）不算，靠大小写和边界排除。

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = ["data", "app", "components"];

const PATTERNS = [
  // 独立的大写 PLACEHOLDER（前后不是标识符字符）
  /(?<![A-Za-z0-9_])PLACEHOLDER(?![A-Za-z0-9_])/,
  /【示例】/,
  /待替换/,
];

function* walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.tsx?$/.test(e.name)) yield p;
  }
}

/** 剥注释，保留行号（块注释里的换行留着）。`//` 前必须是行首或空白，避免误伤 https:// */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

const hits = [];
for (const d of DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, i) => {
      if (PATTERNS.some((re) => re.test(line))) {
        hits.push(`${relative(ROOT, file).replaceAll("\\", "/")}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    });
  }
}

if (hits.length > 0) {
  console.error(`[check-placeholders] 发现 ${hits.length} 处占位内容，构建中止：\n`);
  for (const h of hits) console.error("  " + h);
  console.error("\n换成真实内容，或删掉该条目（空数组有空态兜底）。");
  process.exit(1);
}
console.log("[check-placeholders] 通过");
