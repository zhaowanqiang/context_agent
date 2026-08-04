"use server";

import { requireAdmin } from "@/lib/adminAuth";
import { getGuideById } from "@/lib/guides";
import type { TrayImage } from "@/lib/packagerRender";
import { IMAGE_SLOT_PREFIX } from "@/lib/xthread";

/* 装配台的两个服务端动作。两者都自带 requireAdmin：server action 是能被直接
   POST 触达的端点，不能只靠 proxy.ts 的路由匹配（见 lib/adminAuth.ts 的说明）。 */

export interface GuideSource {
  ok: boolean;
  error?: string;
  title: string;
  /** 已把 ![](url) 换成 [[n]] 标记的正文 */
  markdown: string;
  images: TrayImage[];
  /** 原文里还没填图的配图位数量——直接略过了，提示调用方 */
  skippedSlots: number;
}

const FAIL = (error: string): GuideSource => ({
  ok: false,
  error,
  title: "",
  markdown: "",
  images: [],
  skippedSlots: 0,
});

/**
 * 把站内教程转成装配台的输入。
 *
 * 三处转换：
 * 1. `![图注](url)` → 托盘图 + 正文里的 `[[n]]` 标记（装配台只认后者）
 * 2. 未填的配图位（url 是 IMG_3 这种占位）直接删掉——它没有图，留着只会渲染成「缺图」红框
 * 3. `::referral{id=...}` 返佣卡标记删掉——那是网页阅读层的组件，纸质成品里没有对应物
 */
export async function loadGuideSource(id: string): Promise<GuideSource> {
  await requireAdmin();
  try {
    const guide = await getGuideById(id);
    if (!guide) return FAIL("这篇教程不存在（可能刚被删掉）");

    const images: TrayImage[] = [];
    let skippedSlots = 0;

    const md = guide.content_md
      .replace(/\r\n/g, "\n")
      // 整行的返佣标记
      .replace(/^[ \t]*::referral\{[^}]*\}[ \t]*$/gm, "")
      .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (whole, alt: string, url: string) => {
        if (url.startsWith(IMAGE_SLOT_PREFIX)) {
          skippedSlots++;
          return "";
        }
        if (!/^https?:\/\//i.test(url)) return whole; // 认不出的链接原样留着，别悄悄吞掉内容
        images.push({
          name: url.split("/").pop()?.split("?")[0] || `图 ${images.length + 1}`,
          src: url,
          // 教程里的 alt 常写成「配图 3」这种占位，那不是图注，不带进来
          cap: /^配图\s*\d+$/.test(alt.trim()) ? "" : alt.trim(),
          remote: true,
        });
        return `\n\n[[${images.length}]]\n\n`;
      })
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { ok: true, title: guide.title, markdown: md, images, skippedSlots };
  } catch (e) {
    return FAIL((e as Error).message);
  }
}

/** 单张图的体积上限：base64 后约 +33%，8MB 原图已经远超教程配图的正常尺寸 */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * 把一张远程图抓成 data:URI，好让「导出单文件 HTML」真的是单文件。
 *
 * 为什么在服务端抓而不是浏览器里 fetch：图在 Supabase 公开桶上，跨域能不能读
 * 取决于桶的 CORS 配置，改了桶配置又会影响别处；服务端抓没有这个变量。
 *
 * 一次一张（客户端自己循环）：一张图 base64 后可能几 MB，攒成一个响应
 * 既慢又没有进度可言，逐张返回还能让失败的那张单独重试。
 */
export async function inlineRemoteImage(
  url: string
): Promise<{ ok: boolean; dataUri?: string; error?: string }> {
  await requireAdmin();
  try {
    const u = new URL(url);
    // 只走公网 https/http，且不解析到本机——这个动作等于让服务器代为发请求，
    // 不设边界就是一个开放代理（哪怕已经要管理员身份）
    if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "只支持 http/https 链接" };
    if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.)|^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname))
      return { ok: false, error: "拒绝抓取内网地址" };

    const res = await fetch(u, { signal: AbortSignal.timeout(20_000), redirect: "follow" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!type.startsWith("image/")) return { ok: false, error: `不是图片（${type || "未知类型"}）` };

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES)
      return { ok: false, error: `图太大（${(buf.byteLength / 1024 / 1024).toFixed(1)}MB）` };

    return { ok: true, dataUri: `data:${type};base64,${buf.toString("base64")}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
