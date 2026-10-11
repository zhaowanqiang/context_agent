// 构建期校验 data/tutorials.json（package.json 的 prebuild 调用）。
// 项目没有 zod 之类的校验库，沿用「TS 类型 + 构建期脚本」的做法：
// 类型（lib/tutorialTypes.ts）管编辑器里的提示，这里管 JSON 真的长成那样。
//
// 新增 / 修改教程后直接 npm run build，结构写错会在这里报出具体是哪一条。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/tutorials.json"), "utf8"));
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isUrl = (v) => isStr(v) && v.startsWith("https://");
// slug 同时是 URL hash 和机器人 start 参数，只允许小写字母、数字、连字符
const isSlug = (v) => isStr(v) && /^[a-z0-9-]+$/.test(v);

for (const k of ["botUsername", "groupLink"]) if (!isStr(data[k])) err("root", `缺少 ${k}`);
if (!isUrl(data.groupLink)) err("root", "groupLink 不是 https 链接");
if (!Array.isArray(data.categories) || !Array.isArray(data.tutorials)) {
  console.error("[check-tutorials] categories / tutorials 必须是数组");
  process.exit(1);
}

const catIds = new Set();
for (const c of data.categories) {
  const w = `categories[${c.id}]`;
  if (!isSlug(c.id)) err(w, "id 只能是小写字母 / 数字 / 连字符");
  if (catIds.has(c.id)) err(w, "分类 id 重复");
  catIds.add(c.id);
  if (!isStr(c.name)) err(w, "缺少 name");
  if (!Array.isArray(c.tutorials)) err(w, "tutorials 必须是数组");
}

const slugs = new Set();
for (const t of data.tutorials) {
  const w = `tutorials[${t.slug}]`;
  if (!isSlug(t.slug)) err(w, "slug 只能是小写字母 / 数字 / 连字符");
  if (slugs.has(t.slug)) err(w, "slug 重复");
  slugs.add(t.slug);
  // /tutorials#xxx 既可能是分类也可能是教程，撞名就有歧义
  if (catIds.has(t.slug)) err(w, "slug 与分类 id 撞名，hash 深链会有歧义");
  for (const k of ["name", "keyword", "summary"]) if (!isStr(t[k])) err(w, `缺少 ${k}`);
  if (!catIds.has(t.category)) err(w, `category「${t.category}」不存在`);
  if (!isUrl(t.telegramDeepLink)) err(w, "telegramDeepLink 不是 https 链接");
  if (!Array.isArray(t.related)) err(w, "related 必须是数组");
  if (!Array.isArray(t.sections) || t.sections.length === 0) err(w, "sections 不能为空");
  for (const [i, s] of (t.sections ?? []).entries()) {
    const sw = `${w}.sections[${i}]`;
    if (!isStr(s.title)) err(sw, "缺少 title");
    for (const k of ["notes", "codes", "links", "items"]) {
      if (!Array.isArray(s[k])) err(sw, `${k} 必须是数组（没有就写 []）`);
    }
    for (const n of s.notes ?? []) if (!isStr(n)) err(sw, "notes 里有空字符串");
    for (const c of s.codes ?? []) if (!isStr(c)) err(sw, "codes 里有空字符串");
    for (const l of s.links ?? []) {
      if (!isStr(l.label)) err(sw, "链接缺少 label");
      if (!isUrl(l.url)) err(sw, `链接不是 https：${l.url}`);
      if (l.kind !== "register" && l.kind !== "tutorial") err(sw, `链接 kind 只能是 register / tutorial：${l.kind}`);
    }
    for (const it of s.items ?? []) {
      if (!isStr(it.name)) err(sw, "items 里有条目缺少 name");
      if (it.url !== null && !isUrl(it.url)) err(sw, `条目「${it.name}」的 url 不是 https 也不是 null`);
      if (it.code !== null && !isStr(it.code)) err(sw, `条目「${it.name}」的 code 既不是字符串也不是 null`);
      if (typeof it.text !== "string") err(sw, `条目「${it.name}」缺少 text`);
    }
    if (s.shared !== undefined && !isSlug(s.shared)) err(sw, "shared 只能是小写字母 / 数字 / 连字符");
  }
}

// 引用完整性
for (const c of data.categories) {
  for (const s of c.tutorials ?? []) {
    if (!slugs.has(s)) err(`categories[${c.id}]`, `列了不存在的教程 ${s}`);
    else if (data.tutorials.find((t) => t.slug === s).category !== c.id) {
      err(`categories[${c.id}]`, `教程 ${s} 自己的 category 不是 ${c.id}`);
    }
  }
}
const listed = new Set(data.categories.flatMap((c) => c.tutorials ?? []));
for (const t of data.tutorials) {
  if (!listed.has(t.slug)) err(`tutorials[${t.slug}]`, "没有被任何分类列出，页面上不会出现");
  for (const r of t.related ?? []) if (!slugs.has(r)) err(`tutorials[${t.slug}]`, `related 指向不存在的教程 ${r}`);
}

// 共用推荐位：同一个 shared id 的各段必须完全一致——页面只渲染一份，不一致就说不清用的是哪份
const sharedSeen = new Map();
for (const t of data.tutorials) {
  for (const s of t.sections ?? []) {
    if (!s.shared) continue;
    const json = JSON.stringify(s);
    if (!sharedSeen.has(s.shared)) sharedSeen.set(s.shared, { json, slug: t.slug });
    else if (sharedSeen.get(s.shared).json !== json) {
      err(`tutorials[${t.slug}]`, `shared「${s.shared}」的内容与 ${sharedSeen.get(s.shared).slug} 里的不一致`);
    }
  }
}

// 站内顶栏「加入交流群」读的是 lib/site.ts，与 JSON 的 groupLink / botUsername 对不上就是两套入口
const site = readFileSync(join(root, "lib/site.ts"), "utf8");
if (!site.includes(`"${data.groupLink}"`)) err("root", "groupLink 与 lib/site.ts 的 TG_GROUP_URL 不一致");
if (!site.includes(`"@${data.botUsername}"`)) err("root", "botUsername 与 lib/site.ts 的 TG_BOT 不一致");

if (errors.length > 0) {
  console.error(`[check-tutorials] data/tutorials.json 有 ${errors.length} 处问题，构建中止：\n`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`[check-tutorials] 通过（${data.categories.length} 个分类，${data.tutorials.length} 篇教程）`);
