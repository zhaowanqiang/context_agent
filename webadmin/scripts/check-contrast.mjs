// 主题对比度核算：从 app/globals.css 读出浅色 / 夜间两套语义变量，
// 按「文字色 on 底色」逐对算 WCAG 对比度，正文与按钮文字要求 ≥ 4.5:1（AA）。
// 用法：node scripts/check-contrast.mjs   （有不达标项时退出码 1）
//
// 改夜间色值之后跑一遍——肉眼看着「差不多」的暖灰，差 0.3 就可能掉出 AA。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../app/globals.css"), "utf8");

function block(selector) {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`globals.css 里找不到 ${selector} 块`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const vars = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = block(":root");
// 夜间块只写了要变的；没写的沿用浅色。浅色下色阶走 Tailwind 默认值，这里补上用得到的几级
const TAILWIND_LIGHT = {
  "--color-amber-100": "#fef3c7",
  "--color-emerald-600": "#059669",
};
const themes = { light: { ...TAILWIND_LIGHT, ...light }, dark: { ...TAILWIND_LIGHT, ...light, ...block('[data-theme="dark"]') } };

function resolve(vars, name) {
  let v = vars[name];
  for (let i = 0; v?.startsWith("var(") && i < 5; i++) v = vars[v.slice(4, -1)];
  if (!/^#[0-9a-f]{6}$/i.test(v ?? "")) throw new Error(`${name} 解析不出色值：${v}`);
  return v;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [文字, 底, 说明]。全部按正文字号要求 4.5:1 */
const PAIRS = [
  ["--ink", "--page", "主文字 / 页面底"],
  ["--ink", "--surface", "主文字 / 卡片面"],
  ["--ink-strong", "--surface", "标题 / 卡片面"],
  ["--ink-body", "--page", "长文正文 / 页面底"],
  ["--ink-muted", "--page", "次文字 / 页面底"],
  ["--ink-muted", "--surface", "次文字 / 卡片面"],
  ["--ink-muted", "--surface-muted", "次文字 / 次级面（引用块）"],
  ["--ink-subtle", "--page", "三级文字 / 页面底"],
  ["--ink-subtle", "--surface", "三级文字 / 卡片面"],
  ["--accent", "--page", "强调文字·链接 / 页面底"],
  ["--accent", "--surface", "强调文字·链接 / 卡片面"],
  ["--accent", "--surface-muted", "行内代码 / 次级面"],
  ["--accent", "--accent-soft", "强调文字 / 强调浅底"],
  ["--accent-strong", "--accent-soft", "强调深字 / 强调浅底"],
  ["--accent-strong", "--color-amber-100", "徽章文字 / 徽章底"],
  ["--on-solid", "--accent-solid", "强调按钮文字"],
  ["--on-solid", "--accent-solid-hover", "强调按钮文字（hover）"],
  ["--on-solid", "--solid", "深色按钮文字"],
  ["--on-solid", "--solid-hover", "深色按钮文字（hover）"],
  ["--ok", "--ok-soft", "成功徽章"],
  ["--ok", "--surface", "成功文字 / 卡片面"],
  ["--color-emerald-600", "--surface", "核对时间绿字 / 卡片面"],
  ["--bad", "--surface", "报错文字 / 卡片面"],
  ["--bad", "--bad-soft", "报错文字 / 报错底"],
];

/** 浅色下改造前就不达标的两处。主题改造约定「浅色视觉不变」所以没动，列出来不让它们
 *  把脚本搞成常年红——要修的话改 Tailwind 类（emerald-600 → 700、red-600 → 700）后从这里删掉 */
const KNOWN_LIGHT = new Set([
  "light:--color-emerald-600:--surface",
  "light:--bad:--bad-soft",
]);

let failed = 0;
for (const [name, vars] of Object.entries(themes)) {
  console.log(`\n── ${name} ──`);
  for (const [fg, bg, label] of PAIRS) {
    const ratio = contrast(resolve(vars, fg), resolve(vars, bg));
    const ok = ratio >= 4.5;
    const known = !ok && KNOWN_LIGHT.has(`${name}:${fg}:${bg}`);
    if (!ok && !known) failed++;
    console.log(`${ok ? "  ok " : known ? " known" : " FAIL"}  ${ratio.toFixed(2).padStart(5)}  ${label}  (${fg} on ${bg})`);
  }
}
if (failed > 0) {
  console.error(`\n${failed} 项低于 4.5:1`);
  process.exit(1);
}
console.log("\n全部 ≥ 4.5:1");
